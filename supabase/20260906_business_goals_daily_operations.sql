-- Requiere las macrofases anteriores y 20260822_inventory_bulk_management.sql.
-- No ejecutar automaticamente. No genera movimientos de stock, caja ni comision.
begin;

create table if not exists public.business_settings (
  id boolean primary key default true check (id),
  daily_delivered_goal integer not null default 10 check (daily_delivered_goal between 1 and 100000),
  weekly_delivered_goal integer not null default 60 check (weekly_delivered_goal between 1 and 1000000),
  monthly_delivered_goal integer not null default 260 check (monthly_delivered_goal between 1 and 10000000),
  timezone text not null default 'America/Asuncion' check (timezone = 'America/Asuncion'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.business_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.daily_business_closures (
  business_date date primary key,
  goal integer not null check (goal > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null
);
alter table public.business_settings enable row level security;
alter table public.daily_business_closures enable row level security;
revoke all on public.business_settings, public.daily_business_closures from public, anon, authenticated;
grant select on public.business_settings, public.daily_business_closures to authenticated;
drop policy if exists "Admins read business settings" on public.business_settings;
create policy "Admins read business settings" on public.business_settings for select to authenticated using (public.is_admin());
drop policy if exists "Admins read daily closures" on public.daily_business_closures;
create policy "Admins read daily closures" on public.daily_business_closures for select to authenticated using (public.is_admin());

-- IDENTITY asigna numeros tambien a filas historicas sin UPDATE ni disparar
-- los triggers financieros/de snapshots existentes. El orden historico no es cronologico.
alter table public.sales add column if not exists sale_number bigint generated always as identity;
create unique index if not exists sales_sale_number_unique_idx on public.sales(sale_number);
alter table public.sales
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_note text,
  add column if not exists returned_at timestamptz;
alter table public.sales drop constraint if exists sales_cancellation_reason_check;
alter table public.sales add constraint sales_cancellation_reason_check check (
  cancellation_reason is null or cancellation_reason in (
    'customer_changed_mind','no_response','delivery','price','not_available','order_error','out_of_stock','other'
  )
);
create index if not exists sales_business_delivered_idx on public.sales(delivered_at, sale_type) where status = 'delivered_paid';
create index if not exists sales_business_cancelled_idx on public.sales(cancelled_at) where status = 'cancelled';
create index if not exists sale_events_business_status_idx on public.sale_events(sale_id,to_status,created_at desc)
  where event_type in ('sale_created','status_changed');

create or replace function public.prepare_sale_business_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.sale_number is distinct from old.sale_number then
      raise exception 'El codigo del pedido es inmutable.';
    end if;
    if new.status is not distinct from old.status then return new; end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.status = 'cancelled' and (
      new.cancellation_reason is null or new.cancellation_reason is not distinct from old.cancellation_reason
    ) and nullif(current_setting('camaraza.cancel_sale_id', true), '') is distinct from new.id::text then
      raise exception 'Para cancelar el pedido selecciona un motivo mediante la accion Cancelar.';
    end if;
  end if;
  if new.status = 'cancelled' and new.cancellation_reason is null then
    raise exception 'El motivo de cancelacion es obligatorio.';
  end if;
  if new.status = 'confirmed' then new.confirmed_at := coalesce(new.confirmed_at, now()); end if;
  if new.status = 'out_for_delivery' then new.dispatched_at := coalesce(new.dispatched_at, now()); end if;
  if new.status = 'delivered_paid' then
    new.delivered_at := coalesce(new.delivered_at, now());
    new.paid_at := coalesce(new.paid_at, now());
  end if;
  if new.status = 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now()); end if;
  if new.status = 'returned' then new.returned_at := coalesce(new.returned_at, now()); end if;
  return new;
end;
$$;
drop trigger if exists zz_sales_business_fields on public.sales;
create trigger zz_sales_business_fields before insert or update on public.sales
for each row execute function public.prepare_sale_business_fields();

-- Wrapper atomico: conserva firma y comportamiento de la transicion anterior.
create or replace function public.admin_cancel_sale(p_sale_id uuid, p_reason text, p_note text default null)
returns table(id uuid, status text, delivered_at timestamptz, paid_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_sale public.sales%rowtype;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Solo administradores activos.'; end if;
  if p_reason is null or p_reason not in ('customer_changed_mind','no_response','delivery','price','not_available','order_error','out_of_stock','other') then
    raise exception 'Selecciona un motivo de cancelacion valido.';
  end if;
  select s.* into v_sale from public.sales s where s.id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada.'; end if;
  if v_sale.status = 'cancelled' then
    return query select v_sale.id, v_sale.status, v_sale.delivered_at, v_sale.paid_at;
    return;
  end if;
  if v_sale.status in ('delivered_paid','returned') then raise exception 'Una venta entregada requiere registrar devolucion.'; end if;
  perform set_config('camaraza.cancel_sale_id', p_sale_id::text, true);
  update public.sales s set cancellation_reason = p_reason, cancellation_note = nullif(btrim(p_note), '') where s.id = p_sale_id;
  return query select t.id, t.status, t.delivered_at, t.paid_at
    from public.admin_transition_sale_status(p_sale_id, 'cancelled', p_reason || coalesce(': ' || nullif(btrim(p_note), ''), ''), null, null) t;
  perform set_config('camaraza.cancel_sale_id', '', true);
end;
$$;

create or replace function public.admin_save_business_goals(p_daily integer, p_weekly integer, p_monthly integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_settings public.business_settings%rowtype;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Solo administradores activos.'; end if;
  update public.business_settings b set daily_delivered_goal = p_daily, weekly_delivered_goal = p_weekly,
    monthly_delivered_goal = p_monthly, updated_at = now(), updated_by = auth.uid() where b.id
    returning b.* into v_settings;
  return to_jsonb(v_settings);
end;
$$;

create or replace function public.admin_save_cancelled_sale(p_payload jsonb, p_sale_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_reason text := p_payload->>'cancellation_reason';
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Solo administradores activos.'; end if;
  if v_reason is null or v_reason not in ('customer_changed_mind','no_response','delivery','price','not_available','order_error','out_of_stock','other') then
    raise exception 'Selecciona un motivo de cancelacion valido.';
  end if;
  -- pending_contact es transitorio dentro de esta transaccion: no reserva stock.
  v_id := public.admin_save_sale(
    p_sale_id => p_sale_id,
    p_sale_type => p_payload->>'sale_type',
    p_customer_id => nullif(p_payload->>'customer_id','')::uuid,
    p_reseller_id => nullif(p_payload->>'reseller_id','')::uuid,
    p_items => p_payload->'items', p_status => 'pending_contact',
    p_delivery_charged => (p_payload->>'delivery_charged')::numeric,
    p_delivery_city => p_payload->>'delivery_city', p_delivery_reference => p_payload->>'delivery_reference',
    p_delivery_schedule => p_payload->>'delivery_schedule', p_fulfillment_type => p_payload->>'fulfillment_type',
    p_payment_method => p_payload->>'payment_method', p_payment_timing => p_payload->>'payment_timing',
    p_admin_notes => p_payload->>'admin_notes', p_reseller_visible_notes => p_payload->>'reseller_visible_notes',
    p_customer_name => p_payload->>'customer_name', p_customer_phone => p_payload->>'customer_phone',
    p_customer_document => p_payload->>'customer_document', p_shipping_carrier_name => p_payload->>'shipping_carrier_name'
  );
  perform public.admin_cancel_sale(v_id,v_reason,p_payload->>'cancellation_note');
  return v_id;
end;
$$;

-- Todas las fechas del negocio se resuelven en SQL, incluidos domingos.
create or replace function public.get_admin_business_report(
  p_from date default null, p_to date default null, p_period text default 'month', p_details boolean default true
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Asuncion')::date;
  v_from date; v_to date; v_start timestamptz; v_end timestamptz;
  v_result jsonb;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Solo administradores activos.'; end if;
  if p_period not in ('today','week','month','custom') or p_period is null then raise exception 'Periodo invalido.'; end if;
  v_from := case p_period when 'today' then v_today when 'week' then date_trunc('week', v_today::timestamp)::date
    when 'month' then date_trunc('month', v_today::timestamp)::date else p_from end;
  v_to := case when p_period = 'custom' then p_to else v_today end;
  if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 366 then raise exception 'Selecciona un rango de hasta 367 dias.'; end if;
  v_start := v_from::timestamp at time zone 'America/Asuncion';
  v_end := (v_to + 1)::timestamp at time zone 'America/Asuncion';
  with delivered as materialized (
    select s.* from public.sales s where s.status = 'delivered_paid' and s.delivered_at >= v_start and s.delivered_at < v_end
  ), operational as materialized (
    select s.*, coalesce((select max(e.created_at) from public.sale_events e
      where e.sale_id = s.id and e.to_status = s.status and e.event_type in ('sale_created','status_changed')),
      case s.status when 'confirmed' then s.confirmed_at when 'out_for_delivery' then s.dispatched_at else s.cancelled_at end) state_at
    from public.sales s where s.status in ('confirmed','out_for_delivery','cancelled')
  ), cancelled as materialized (
    select s.* from operational s where s.status = 'cancelled' and s.state_at >= v_start and s.state_at < v_end
  ), channels as (
    select c.kind, count(s.id) delivered_count, coalesce(sum(s.total_collected),0) revenue,
      coalesce(sum(s.camaraza_net_profit),0) operating_profit, coalesce(sum(s.reseller_commission),0) commissions_generated
    from (values ('direct'),('reseller')) c(kind) left join delivered s on s.sale_type = c.kind group by c.kind
  ), days as (
    select (v_from + n.i) business_date, count(s.id) delivered_count
    from generate_series(0, v_to - v_from) n(i)
    left join delivered s on (s.delivered_at at time zone 'America/Asuncion')::date = v_from + n.i group by n.i
  ), costs as (
    select coalesce(sum(e.amount),0) amount from public.expenses e where e.status = 'confirmed' and e.expense_date between v_from and v_to
  ), manual_costs as (
    select coalesce(sum(m.amount),0) amount from public.financial_movements m
    where m.movement_type = 'manual_expense' and m.direction = 'expense' and not m.is_reversal
      and m.occurred_at >= v_start and m.occurred_at < v_end
      and not exists (select 1 from public.financial_movements r where r.reversed_movement_id = m.id)
  ), product_totals as (
    select i.product_id, max(i.product_name_snapshot) name, sum(i.quantity) units,
      sum(i.line_subtotal) revenue, sum(i.line_subtotal - i.line_cost_total - i.line_commission_total) profit
    from public.sale_items i join delivered s on s.id = i.sale_id group by i.product_id
  ), product_30 as (
    select i.product_id, sum(i.quantity) units_30 from public.sale_items i join public.sales s on s.id = i.sale_id
    where s.status = 'delivered_paid'
      and s.delivered_at >= (v_today - 29)::timestamp at time zone 'America/Asuncion'
      and s.delivered_at < (v_today + 1)::timestamp at time zone 'America/Asuncion' group by i.product_id
  ), product_rows as (
    select p.id, p.name, coalesce(t.units,0) units, coalesce(t.revenue,0) revenue, coalesce(t.profit,0) profit,
      p.available_stock_quantity stock, coalesce(r.units_30,0) units_30
    from public.products p left join product_totals t on t.product_id = p.id left join product_30 r on r.product_id = p.id
    where t.product_id is not null or r.product_id is not null
  )
  select jsonb_build_object(
    'date_from', v_from, 'date_to', v_to, 'business_date', v_today,
    'delivered_count', (select count(*) from delivered),
    'created_count', (select count(*) from public.sales s where s.created_at >= v_start and s.created_at < v_end),
    'coordinated_count', (select count(*) from operational s where s.status = 'confirmed' and s.state_at >= v_start and s.state_at < v_end),
    'out_for_delivery_count', (select count(*) from operational s where s.status = 'out_for_delivery' and s.state_at >= v_start and s.state_at < v_end),
    'cancelled_count', (select count(*) from cancelled),
    'cancellation_rate', coalesce(round(100.0 * (select count(*) from cancelled) / nullif((select count(*) from cancelled) + (select count(*) from delivered),0),2),0),
    'revenue', (select coalesce(sum(s.total_collected),0) from delivered s),
    'operating_profit', (select coalesce(sum(s.camaraza_net_profit),0) from delivered s),
    'expenses', (select c.amount + m.amount from costs c cross join manual_costs m),
    'net_profit', (select coalesce(sum(s.camaraza_net_profit),0) from delivered s) - (select c.amount + m.amount from costs c cross join manual_costs m),
    'commissions_generated', (select coalesce(sum(s.reseller_commission),0) from delivered s where s.sale_type = 'reseller'),
    'units_sold', (select coalesce(sum(i.quantity),0) from public.sale_items i join delivered s on s.id = i.sale_id),
    'cash_income', (select coalesce(sum(m.amount),0) from public.financial_movements m where m.direction = 'income' and m.movement_type not in ('transfer_in','opening_balance') and m.occurred_at >= v_start and m.occurred_at < v_end),
    'cash_expense', (select coalesce(sum(m.amount),0) from public.financial_movements m where m.direction = 'expense' and m.movement_type <> 'transfer_out' and m.occurred_at >= v_start and m.occurred_at < v_end),
    'resellers', case when p_details then (select coalesce(jsonb_agg(to_jsonb(r) order by r.delivered_count desc),'[]') from (
      select p.id, p.full_name name, count(s.id) delivered_count, sum(s.total_collected) revenue, sum(s.reseller_commission) commission
      from delivered s join public.profiles p on p.id = s.reseller_id where s.sale_type = 'reseller' group by p.id, p.full_name
    ) r) else '[]'::jsonb end,
    'channels', (select coalesce(jsonb_agg(to_jsonb(c) order by c.kind),'[]') from channels c),
    'days', (select coalesce(jsonb_agg(to_jsonb(d) order by d.business_date),'[]') from days d),
    'products', case when p_details then (select coalesce(jsonb_agg(to_jsonb(p) order by p.units desc, p.name),'[]') from product_rows p) else '[]'::jsonb end,
    'cancellation_reasons', (select coalesce(jsonb_agg(to_jsonb(r) order by r.count desc),'[]') from (
      select coalesce(c.cancellation_reason,'historical_unknown') reason, count(*) count from cancelled c group by c.cancellation_reason
    ) r)
  ) into v_result;
  return v_result || jsonb_build_object('potential_count', (v_result->>'delivered_count')::bigint + (v_result->>'coordinated_count')::bigint + (v_result->>'out_for_delivery_count')::bigint);
end;
$$;

create or replace function public.get_admin_business_resellers(p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_date date := coalesce(p_date,(now() at time zone 'America/Asuncion')::date);
  v_day timestamptz := v_date::timestamp at time zone 'America/Asuncion';
  v_end timestamptz := (v_date + 1)::timestamp at time zone 'America/Asuncion';
  v_week timestamptz := date_trunc('week',v_date::timestamp) at time zone 'America/Asuncion';
  v_month timestamptz := date_trunc('month',v_date::timestamp) at time zone 'America/Asuncion';
  v_result jsonb;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Solo administradores activos.'; end if;
  with sale_rows as (
    select s.*, case when s.status = 'cancelled' then coalesce((select max(e.created_at) from public.sale_events e
      where e.sale_id = s.id and e.to_status = 'cancelled' and e.event_type in ('sale_created','status_changed')),s.cancelled_at) end cancellation_at
    from public.sales s where s.sale_type = 'reseller'
  ), stats as (
    select s.reseller_id,
      count(*) filter (where s.status = 'delivered_paid' and s.delivered_at >= v_day and s.delivered_at < v_end) delivered_today,
      count(*) filter (where s.status = 'delivered_paid' and s.delivered_at >= v_week and s.delivered_at < v_end) delivered_week,
      count(*) filter (where s.status = 'delivered_paid' and s.delivered_at >= v_month and s.delivered_at < v_end) delivered_month,
      count(*) filter (where s.status = 'cancelled' and s.cancellation_at >= v_month and s.cancellation_at < v_end) cancelled_month,
      coalesce(sum(s.total_collected) filter (where s.status = 'delivered_paid' and s.delivered_at >= v_month and s.delivered_at < v_end),0) revenue_month,
      coalesce(sum(s.reseller_commission) filter (where s.status = 'delivered_paid' and s.delivered_at >= v_month and s.delivered_at < v_end),0) commission_month,
      coalesce(sum(s.reseller_commission) filter (where s.status = 'delivered_paid' and not s.commission_paid),0) commission_pending,
      max(s.created_at) last_sale_at
    from sale_rows s group by s.reseller_id
  ), paid as (
    select c.reseller_id, sum(c.net_paid) commission_paid from public.commission_payments c where c.status = 'paid' group by c.reseller_id
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.delivered_month desc, r.name),'[]') into v_result from (
    select p.id, p.full_name name, p.reseller_code, p.is_active,
      coalesce(s.delivered_today,0) delivered_today, coalesce(s.delivered_week,0) delivered_week,
      coalesce(s.delivered_month,0) delivered_month, coalesce(s.cancelled_month,0) cancelled_month,
      coalesce(s.revenue_month,0) revenue_month, coalesce(s.commission_month,0) commission_month,
      coalesce(s.commission_pending,0) commission_pending, coalesce(c.commission_paid,0) commission_paid, s.last_sale_at
    from public.profiles p left join stats s on s.reseller_id = p.id left join paid c on c.reseller_id = p.id where p.role = 'reseller'
  ) r;
  return v_result;
end;
$$;

create or replace function public.get_admin_business_dashboard(p_date date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_date date := coalesce(p_date,(now() at time zone 'America/Asuncion')::date);
  v_settings public.business_settings%rowtype;
  v_month jsonb; v_chart jsonb; v_streak bigint; v_last date;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Solo administradores activos.'; end if;
  select b.* into strict v_settings from public.business_settings b where b.id;
  v_month := public.get_admin_business_report(date_trunc('month',v_date::timestamp)::date,v_date,'custom',false);
  v_chart := public.get_admin_business_report(v_date - 13,v_date,'custom',false)->'days';
  -- Hoy no interrumpe una racha hasta finalizar el dia, salvo que ya cumpla la meta.
  select case when count(*) >= v_settings.daily_delivered_goal then v_date else v_date - 1 end into v_last
    from public.sales s where s.status = 'delivered_paid'
      and s.delivered_at >= v_date::timestamp at time zone 'America/Asuncion'
      and s.delivered_at < (v_date+1)::timestamp at time zone 'America/Asuncion';
  with counts as (
    select (s.delivered_at at time zone 'America/Asuncion')::date d, count(*) n from public.sales s
    where s.status = 'delivered_paid' and s.delivered_at < (v_last+1)::timestamp at time zone 'America/Asuncion' group by 1
  ), consecutive as (
    select c.d, row_number() over (order by c.d desc) rn from counts c where c.n >= v_settings.daily_delivered_goal
  ) select count(*) into v_streak from consecutive c where c.d = v_last - (c.rn::integer - 1);
  return jsonb_build_object(
    'business_date',v_date,'settings',to_jsonb(v_settings),
    'today',public.get_admin_business_report(v_date,v_date,'custom',false),
    'week',public.get_admin_business_report(date_trunc('week',v_date::timestamp)::date,v_date,'custom',false),
    'month',v_month,'chart',v_chart,'streak',v_streak,
    'days_goal_met',(select count(*) from jsonb_to_recordset(v_month->'days') d(delivered_count integer) where d.delivered_count >= v_settings.daily_delivered_goal),
    'best_day',(select max(d.delivered_count) from jsonb_to_recordset(v_month->'days') d(delivered_count integer)),
    'finance',public.get_admin_finance_dashboard(),
    'ranking',public.get_admin_business_resellers(v_date),
    'closure',(select to_jsonb(c) from public.daily_business_closures c where c.business_date = v_date),
    'closures',(select coalesce(jsonb_agg(to_jsonb(c) order by c.business_date desc),'[]') from
      (select d.* from public.daily_business_closures d order by d.business_date desc limit 30) c)
  );
end;
$$;

create or replace function public.admin_close_business_day(p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_goal integer; v_snapshot jsonb; v_row public.daily_business_closures%rowtype;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Solo administradores activos.'; end if;
  if p_date is null or p_date > (now() at time zone 'America/Asuncion')::date then raise exception 'Fecha de cierre invalida.'; end if;
  -- Serializa cierres y cambios de meta; el primer snapshot gana incluso con dos admins.
  select b.daily_delivered_goal into strict v_goal from public.business_settings b where b.id for update;
  select c.* into v_row from public.daily_business_closures c where c.business_date = p_date;
  if found then return to_jsonb(v_row); end if;
  v_snapshot := public.get_admin_business_report(p_date,p_date,'custom',false) - 'products' - 'days';
  insert into public.daily_business_closures as c (business_date,goal,snapshot,closed_by)
    values(p_date,v_goal,v_snapshot,auth.uid()) returning c.* into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_business_search(p_term text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_term text := left(btrim(coalesce(p_term,'')),100); v_result jsonb;
begin
  if not coalesce(public.is_admin(),false) then raise exception 'Solo administradores activos.'; end if;
  if length(v_term) < 2 then return '[]'::jsonb; end if;
  with matches as (
    select a.result_type,a.result_id,a.title,a.subtitle,a.path from public.admin_global_search(v_term) a
    union
    select 'venta',s.id,s.product_name_snapshot,s.status,'/admin/ventas/' || s.id::text from public.sales s
    where s.sale_number::text = case when v_term ~* '^(PED-)?[0-9]+$' then
      coalesce(nullif(ltrim(regexp_replace(upper(v_term),'^PED-',''),'0'),''),'0') else null end
  ), rows as (
    select m.result_type,m.result_id,
      case when s.id is not null then 'PED-' || lpad(s.sale_number::text,greatest(6,length(s.sale_number::text)),'0') || ' · ' || m.title else m.title end title,
      m.subtitle,m.path from matches m left join public.sales s on m.result_type = 'venta' and s.id = m.result_id
    order by m.result_type,m.title limit 40
  ) select coalesce(jsonb_agg(to_jsonb(r)),'[]') into v_result from rows r;
  return v_result;
end;
$$;

alter function public.prepare_sale_business_fields() owner to postgres;
alter function public.admin_business_search(text) owner to postgres;
revoke all on function public.admin_business_search(text) from public, anon;
grant execute on function public.admin_business_search(text) to authenticated;
alter function public.admin_save_cancelled_sale(jsonb,uuid) owner to postgres;
revoke all on function public.admin_save_cancelled_sale(jsonb,uuid) from public, anon;
grant execute on function public.admin_save_cancelled_sale(jsonb,uuid) to authenticated;
revoke all on function public.prepare_sale_business_fields() from public, anon, authenticated;
alter function public.admin_cancel_sale(uuid,text,text) owner to postgres;
revoke all on function public.admin_cancel_sale(uuid,text,text) from public, anon;
grant execute on function public.admin_cancel_sale(uuid,text,text) to authenticated;
alter function public.admin_save_business_goals(integer,integer,integer) owner to postgres;
revoke all on function public.admin_save_business_goals(integer,integer,integer) from public, anon;
grant execute on function public.admin_save_business_goals(integer,integer,integer) to authenticated;
alter function public.get_admin_business_report(date,date,text,boolean) owner to postgres;
revoke all on function public.get_admin_business_report(date,date,text,boolean) from public, anon;
grant execute on function public.get_admin_business_report(date,date,text,boolean) to authenticated;
alter function public.get_admin_business_resellers(date) owner to postgres;
revoke all on function public.get_admin_business_resellers(date) from public, anon;
grant execute on function public.get_admin_business_resellers(date) to authenticated;
alter function public.get_admin_business_dashboard(date) owner to postgres;
revoke all on function public.get_admin_business_dashboard(date) from public, anon;
grant execute on function public.get_admin_business_dashboard(date) to authenticated;
alter function public.admin_close_business_day(date) owner to postgres;
revoke all on function public.admin_close_business_day(date) from public, anon;
grant execute on function public.admin_close_business_day(date) to authenticated;

-- Misma firma y RETURNS TABLE: no requiere DROP. Ninguna columna privada.
-- Devuelve siempre el ID solicitado, aun si se retiro el producto del catalogo.
create or replace function public.validate_retail_cart(p_items jsonb)
returns table (
  id uuid, slug text, name text, brand text, model text, main_image_url text,
  retail_price numeric, available_stock_quantity integer, track_inventory boolean,
  requested_quantity integer, is_available boolean, issue text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Carrito invalido.'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then raise exception 'El carrito debe contener entre 1 y 100 productos.'; end if;
  return query
  with requested as (
    select r.product_id, sum(r.quantity)::integer quantity
    from jsonb_to_recordset(p_items) r(product_id uuid,quantity integer)
    group by r.product_id
  ), published as (
    select p.id,p.slug,p.name,p.brand,p.model,p.main_image_url,d.retail_price,
      p.available_stock_quantity, d.track_inventory
    from public.products p join public.product_admin_details d on d.product_id = p.id
    where p.internal_status = 'active' and d.publish_to_retail and d.retail_price > 0
  )
  select r.product_id,p.slug,coalesce(p.name,'Producto no disponible'),p.brand,p.model,p.main_image_url,
    p.retail_price,coalesce(p.available_stock_quantity,0),coalesce(p.track_inventory,true),r.quantity,
    coalesce(p.id is not null and r.quantity > 0 and (not p.track_inventory or p.available_stock_quantity >= r.quantity),false),
    case when p.id is null then 'Producto no disponible'
      when r.quantity is null or r.quantity <= 0 then 'Cantidad invalida'
      when p.track_inventory and p.available_stock_quantity <= 0 then 'Producto sin stock'
      when p.track_inventory and p.available_stock_quantity < r.quantity then 'Stock insuficiente'
      else null end
    from requested r left join published p on p.id = r.product_id;
end;
$$;
alter function public.validate_retail_cart(jsonb) owner to postgres;
revoke all on function public.validate_retail_cart(jsonb) from public, anon, authenticated;
grant execute on function public.validate_retail_cart(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
