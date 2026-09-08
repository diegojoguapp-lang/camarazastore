-- Operacion Comercial V2. Aplicacion manual, despues de Storefront V2.1.
begin;

alter table public.sales
  add column if not exists operation_date date,
  add column if not exists customer_contacted_at timestamptz,
  add column if not exists cash_tendered_amount numeric(14,2);

-- El CHECK historico fue creado NOT VALID. Produccion puede contener etiquetas
-- anteriores que pasan a validarse en cualquier UPDATE de la fila. Validar todo
-- el drift conocido antes de escribir, para que un valor desconocido aborte la
-- transaccion con contexto y sin cambios parciales.
do $$
declare
  v_values text;
begin
  select pg_catalog.string_agg(pg_catalog.quote_literal(x.value), ', ' order by x.value)
    into v_values
  from (
    select distinct s.payment_method as value
    from public.sales s
    where s.payment_method is not null
      and pg_catalog.lower(pg_catalog.btrim(s.payment_method)) not in ('cash','efectivo','transfer','transferencia','card')
  ) x;
  if v_values is not null then
    raise exception using
      message = pg_catalog.format('No se puede continuar: sales.payment_method contiene valores no reconocidos: %s.', v_values),
      hint = 'Corregir explicitamente esos valores antes de volver a ejecutar; la migracion no los convierte automaticamente.';
  end if;

  select pg_catalog.string_agg(pg_catalog.quote_nullable(x.value), ', ' order by x.value)
    into v_values
  from (
    select distinct s.payment_timing as value
    from public.sales s
    where s.payment_timing is not null and s.payment_timing not in ('on_delivery','prepaid')
  ) x;
  if v_values is not null then
    raise exception 'No se puede continuar: sales.payment_timing contiene valores incompatibles: %.', v_values;
  end if;

  select pg_catalog.string_agg(pg_catalog.quote_nullable(x.value), ', ' order by x.value)
    into v_values
  from (
    select distinct s.fulfillment_type as value
    from public.sales s
    where coalesce(s.fulfillment_type, 'delivery') not in ('delivery','shipping','pickup','transportadora')
  ) x;
  if v_values is not null then
    raise exception 'No se puede continuar: sales.fulfillment_type contiene valores incompatibles: %.', v_values;
  end if;

  select pg_catalog.string_agg(pg_catalog.quote_nullable(x.value), ', ' order by x.value)
    into v_values
  from (
    select distinct s.sale_type as value
    from public.sales s
    where s.sale_type is null or s.sale_type not in ('direct','reseller')
  ) x;
  if v_values is not null then
    raise exception 'No se puede continuar: sales.sale_type contiene valores incompatibles: %.', v_values;
  end if;

  select pg_catalog.string_agg(pg_catalog.quote_nullable(x.value), ', ' order by x.value)
    into v_values
  from (
    select distinct s.status as value
    from public.sales s
    where s.status is null or s.status not in (
      'pending_contact','confirmed','preparing','out_for_delivery',
      'delivered_paid','cancelled','failed_delivery','returned'
    )
  ) x;
  if v_values is not null then
    raise exception 'No se puede continuar: sales.status contiene valores incompatibles: %.', v_values;
  end if;
end;
$$;

-- Solo metadata operativa. El trigger legacy recalcula montos aun sin cambiar
-- estado; suspender triggers de usuario bajo bloqueo y restaurar sus modos.
lock table public.sales in access exclusive mode;
do $$
declare v_triggers jsonb; v_trigger record;
begin
  select coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'mode',t.tgenabled)),'[]'::jsonb)
    into v_triggers from pg_catalog.pg_trigger t
    where t.tgrelid='public.sales'::regclass and not t.tgisinternal and t.tgenabled in ('O','A');
  for v_trigger in select * from jsonb_to_recordset(v_triggers) as x(name text,mode text) loop
    execute format('alter table public.sales disable trigger %I',v_trigger.name);
  end loop;
  update public.sales s
  set payment_method = case pg_catalog.lower(pg_catalog.btrim(s.payment_method))
    when 'cash' then 'cash'
    when 'efectivo' then 'cash'
    when 'transfer' then 'transfer'
    when 'transferencia' then 'transfer'
    when 'card' then 'card'
  end
  where s.payment_method is not null
    and s.payment_method is distinct from case pg_catalog.lower(pg_catalog.btrim(s.payment_method))
      when 'cash' then 'cash'
      when 'efectivo' then 'cash'
      when 'transfer' then 'transfer'
      when 'transferencia' then 'transfer'
      when 'card' then 'card'
    end;

  alter table public.sales drop constraint if exists sales_payment_method_check;
  alter table public.sales add constraint sales_payment_method_check
    check (payment_method is null or payment_method in ('cash','transfer','card'));

  update public.sales s set operation_date=(s.created_at at time zone 'America/Asuncion')::date
    where s.operation_date is null and s.status in ('pending_contact','confirmed','preparing','out_for_delivery');
  for v_trigger in select * from jsonb_to_recordset(v_triggers) as x(name text,mode text) loop
    execute format('alter table public.sales enable %s trigger %I',case when v_trigger.mode='A' then 'always' else '' end,v_trigger.name);
  end loop;
end; $$;
alter table public.sales alter column operation_date set default ((now() at time zone 'America/Asuncion')::date);
alter table public.sales drop constraint if exists sales_cash_tendered_v2_check;
alter table public.sales add constraint sales_cash_tendered_v2_check check (cash_tendered_amount is null or cash_tendered_amount >= 0);
create index if not exists sales_operation_v2_idx on public.sales(operation_date,status);
create index if not exists sales_reseller_operation_v2_idx on public.sales(reseller_id,operation_date,id);
alter table public.business_settings
  add column if not exists default_cash_account_id uuid references public.financial_accounts(id) on delete restrict,
  add column if not exists default_transfer_account_id uuid references public.financial_accounts(id) on delete restrict;

create or replace function public.admin_set_collection_defaults(p_cash_id uuid, p_transfer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administradores activos.'; end if;
  perform a.id from public.financial_accounts a where a.id in (p_cash_id,p_transfer_id) order by a.id for share;
  if p_cash_id is not null and not exists (select 1 from public.financial_accounts a where a.id=p_cash_id and a.is_active and a.account_type='cash' and a.is_cash_account) then
    raise exception 'Selecciona una cuenta de efectivo activa.';
  end if;
  if p_transfer_id is not null and not exists (select 1 from public.financial_accounts a where a.id=p_transfer_id and a.is_active and a.account_type='bank') then
    raise exception 'Selecciona una cuenta bancaria activa.';
  end if;
  update public.business_settings b set default_cash_account_id=p_cash_id,default_transfer_account_id=p_transfer_id,updated_at=now(),updated_by=auth.uid() where b.id;
end; $$;

-- Guardas a nivel tabla: tambien cubren RPC anteriores. Reversiones conservan la
-- cuenta historica, incluso si fue archivada; no son una nueva operacion comercial.
create or replace function public.guard_financial_account_v2()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'financial_movements' then
    perform a.id from public.financial_accounts a where a.id=new.account_id for share;
    if not coalesce(new.is_reversal,false) and not exists (select 1 from public.financial_accounts a where a.id=new.account_id and a.is_active) then
      raise exception 'La cuenta esta archivada. Selecciona una cuenta activa.';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.financial_movements m where m.account_id=old.id)
      or exists (select 1 from public.sales s where s.financial_account_id=old.id)
      or exists (select 1 from public.cash_sessions c where c.financial_account_id=old.id)
      or exists (select 1 from public.commission_payments p where p.financial_account_id=old.id) then
      raise exception 'La cuenta tiene historial. Archivar en lugar de eliminar.';
    end if;
    -- Las demas relaciones quedan protegidas por sus FK RESTRICT.
    return old;
  end if;
  if new.initial_balance is distinct from old.initial_balance or new.account_type is distinct from old.account_type or new.is_cash_account is distinct from old.is_cash_account then
    raise exception 'El saldo inicial y tipo de una cuenta existente no se editan. Usa un movimiento o una cuenta nueva.';
  end if;
  if old.is_active and not new.is_active then
    if exists (select 1 from public.cash_sessions c where c.financial_account_id=old.id and c.status='open') then raise exception 'Cierra la caja antes de archivar la cuenta.'; end if;
    update public.business_settings b set
      default_cash_account_id=case when b.default_cash_account_id=old.id then null else b.default_cash_account_id end,
      default_transfer_account_id=case when b.default_transfer_account_id=old.id then null else b.default_transfer_account_id end
    where b.id;
  end if;
  return new;
end; $$;
drop trigger if exists financial_accounts_guard_v2 on public.financial_accounts;
create trigger financial_accounts_guard_v2 before update or delete on public.financial_accounts for each row execute function public.guard_financial_account_v2();
drop trigger if exists financial_movements_guard_v2 on public.financial_movements;
create trigger financial_movements_guard_v2 before insert on public.financial_movements for each row execute function public.guard_financial_account_v2();

create or replace function public.admin_manage_account_v2(p_id uuid,p_action text,p_name text default null,p_bank_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administradores activos.'; end if;
  perform a.id from public.financial_accounts a where a.id=p_id for update;
  if not found then raise exception 'Cuenta inexistente.'; end if;
  if p_action='edit' then
    if nullif(btrim(p_name),'') is null then raise exception 'Nombre obligatorio.'; end if;
    update public.financial_accounts a set name=btrim(p_name),bank_name=nullif(btrim(p_bank_name),'') where a.id=p_id;
  elsif p_action in ('archive','restore') then
    update public.financial_accounts a set is_active=(p_action='restore') where a.id=p_id;
  elsif p_action='delete' then
    delete from public.financial_accounts a where a.id=p_id;
  else raise exception 'Accion invalida.'; end if;
exception when foreign_key_violation then raise exception 'La cuenta tiene relaciones existentes. Desactiva la cuenta en lugar de eliminarla.';
end; $$;

create or replace function public.admin_save_sale_v2(p_sale_id uuid,p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_account uuid; v_total numeric; v_cash numeric; v_existing public.sales%rowtype;
  v_method text := coalesce(p_payload->>'payment_method','cash');
  v_date date := coalesce(nullif(p_payload->>'operation_date','')::date,(now() at time zone 'America/Asuncion')::date);
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administradores activos.'; end if;
  if v_method not in ('cash','transfer') then raise exception 'Selecciona efectivo o transferencia.'; end if;
  if p_sale_id is not null then
    select s.* into v_existing from public.sales s where s.id=p_sale_id for update;
    if not found then raise exception 'Pedido inexistente.'; end if;
    if v_existing.status is distinct from p_payload->>'expected_status' or v_existing.updated_at is distinct from nullif(p_payload->>'updated_at','')::timestamptz then
      raise exception 'El pedido cambio en otra ventana. Recarga antes de guardar.';
    end if;
  end if;
  v_account := nullif(p_payload->>'financial_account_id','')::uuid;
  if v_account is null then
    select case when v_method='cash' then b.default_cash_account_id else b.default_transfer_account_id end into v_account from public.business_settings b where b.id;
  end if;
  perform a.id from public.financial_accounts a where a.id=v_account and a.is_active
    and a.account_type=case when v_method='cash' then 'cash' else 'bank' end for share;
  if not found then raise exception 'Configura o selecciona una cuenta activa para este medio de pago.'; end if;
  if p_payload->>'status'='cancelled' then
    v_id := public.admin_save_cancelled_sale(p_payload=>p_payload,p_sale_id=>p_sale_id);
  else
    v_id := public.admin_save_sale(
      p_sale_id=>p_sale_id,p_sale_type=>p_payload->>'sale_type',
      p_customer_id=>nullif(p_payload->>'customer_id','')::uuid,p_reseller_id=>nullif(p_payload->>'reseller_id','')::uuid,
      p_items=>p_payload->'items',p_status=>coalesce(p_payload->>'status','confirmed'),
      p_delivery_charged=>coalesce((p_payload->>'delivery_charged')::numeric,0),p_delivery_city=>p_payload->>'delivery_city',
      p_delivery_reference=>p_payload->>'delivery_reference',p_delivery_schedule=>p_payload->>'delivery_schedule',
      p_fulfillment_type=>p_payload->>'fulfillment_type',p_payment_method=>v_method,p_payment_timing=>p_payload->>'payment_timing',
      p_admin_notes=>p_payload->>'admin_notes',p_reseller_visible_notes=>p_payload->>'reseller_visible_notes',
      p_customer_name=>p_payload->>'customer_name',p_customer_phone=>p_payload->>'customer_phone',
      p_customer_document=>p_payload->>'customer_document',p_shipping_carrier_name=>p_payload->>'shipping_carrier_name');
  end if;
  select s.total_collected into v_total from public.sales s where s.id=v_id for update;
  v_cash := case when v_method='cash' then nullif(p_payload->>'cash_tendered_amount','')::numeric else null end;
  if v_cash is not null and (v_cash < v_total or v_cash='NaN'::numeric) then raise exception 'El efectivo recibido debe cubrir el total a cobrar.'; end if;
  update public.sales s set operation_date=v_date,financial_account_id=v_account,cash_tendered_amount=v_cash where s.id=v_id;
  return v_id;
end; $$;

create or replace function public.admin_operate_sale_v2(p_sale_id uuid,p_expected_status text,p_next_status text default null,p_contacted boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sale public.sales%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administradores activos.'; end if;
  select s.* into v_sale from public.sales s where s.id=p_sale_id for update;
  if not found then raise exception 'Pedido inexistente.'; end if;
  -- Reintento de la misma transicion: sin nuevos eventos, reservas ni cobros.
  if p_next_status is not null and v_sale.status=p_next_status and
    ((p_expected_status='confirmed' and p_next_status='out_for_delivery') or (p_expected_status='out_for_delivery' and p_next_status='delivered_paid')) then return; end if;
  if v_sale.status is distinct from p_expected_status then raise exception 'El pedido cambio en otra ventana. Actualiza el listado.'; end if;
  if p_contacted is not null then
    if v_sale.status<>'confirmed' or p_next_status is not null then raise exception 'El contacto se cambia solo en Coordinado.'; end if;
    update public.sales s set customer_contacted_at=case when p_contacted then coalesce(s.customer_contacted_at,now()) else null end where s.id=p_sale_id;
  elsif (v_sale.status='confirmed' and p_next_status='out_for_delivery') or (v_sale.status='out_for_delivery' and p_next_status='delivered_paid') then
    if p_next_status='delivered_paid' then
      if v_sale.financial_account_id is null then
        select case when v_sale.payment_method='cash' then b.default_cash_account_id when v_sale.payment_method='transfer' then b.default_transfer_account_id else null end
          into v_sale.financial_account_id from public.business_settings b where b.id;
      end if;
      perform a.id from public.financial_accounts a where a.id=v_sale.financial_account_id and a.is_active
        and a.account_type=case when v_sale.payment_method='cash' then 'cash' when v_sale.payment_method='transfer' then 'bank' else null end for share;
      if not found then raise exception 'Selecciona una cuenta de cobro activa antes de marcar como entregado.'; end if;
    end if;
    perform public.admin_transition_sale_status(p_sale_id,p_next_status,null,v_sale.financial_account_id,v_sale.payment_method);
  else raise exception 'Transicion operativa no permitida.'; end if;
end; $$;

create or replace function public.admin_search_sale_products_v2(p_search text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administradores activos.'; end if;
  if length(btrim(coalesce(p_search,'')))<2 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(q.row),'[]'::jsonb) into v_result from (
    select jsonb_build_object('id',p.id,'name',p.name,'brand',p.brand,'model',p.model,'main_image_url',p.main_image_url,
      'stock_quantity',p.stock_quantity,'reserved_stock_quantity',p.reserved_stock_quantity,
      'suggested_price',p.suggested_price,'wholesale_price',p.wholesale_price,'cost_price',p.cost_price,
      'admin_details',jsonb_build_object('sku',d.sku,'retail_price',d.retail_price)) as row
    from public.products p left join public.product_admin_details d on d.product_id=p.id
    where not exists (
      select 1 from regexp_split_to_table(lower(left(btrim(p_search),120)),'\s+') word
      where strpos(lower(concat_ws(' ',p.name,p.brand,p.model,d.sku,
        (select string_agg(c.name,' ') from public.retail_product_categories pc join public.retail_categories c on c.id=pc.category_id where pc.product_id=p.id))),word)=0
    ) order by p.name,p.id limit 20
  ) q;
  return v_result;
end; $$;

create or replace function public.admin_cash_day_v2(p_day date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administradores activos.'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result from (
    select b.*,coalesce(d.income,0) as day_income,coalesce(d.expense,0) as day_expense,coalesce(d.count,0) as day_count,
      b.initial_balance + coalesce((select sum(case when m.direction='income' then m.amount else -m.amount end)
        from public.financial_movements m where m.account_id=b.id and m.movement_type<>'opening_balance'
          and m.occurred_at < p_day::timestamp at time zone 'America/Asuncion'),0) as day_opening_balance
    from public.get_financial_account_balances() b
    left join lateral (
      select sum(m.amount) filter(where m.direction='income') as income,sum(m.amount) filter(where m.direction='expense') as expense,count(*) as count
      from public.financial_movements m where m.account_id=b.id
        and m.occurred_at >= p_day::timestamp at time zone 'America/Asuncion'
        and m.occurred_at < (p_day+1)::timestamp at time zone 'America/Asuncion'
    ) d on true where b.is_active
  ) q;
  return v_result;
end; $$;

-- Fuente unica de clasificacion, privada: los wrappers autorizan antes de llamarla.
create or replace function public.commission_sale_states_v2(p_reseller_id uuid)
returns table(sale_id uuid,amount numeric,bucket text)
language sql stable set search_path = '' as $$
  select s.id,s.reseller_commission,case
    when s.commission_paid then 'paid'
    when s.status in ('pending_contact','confirmed','preparing','out_for_delivery') then 'estimated'
    when s.status='delivered_paid' and extract(isodow from s.delivered_at at time zone 'America/Asuncion') between 1 and 6 then
      case when exists (select 1 from public.commission_payment_items i join public.commission_payments p on p.id=i.payment_id where i.sale_id=s.id and p.status='pending') then 'liquidating' else 'available' end
    else null end
  from public.sales s where s.reseller_id=p_reseller_id and s.sale_type='reseller';
$$;

create or replace function public.commission_balances_v2(p_reseller_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  with classified as (
    select c.sale_id as id,c.amount as reseller_commission,c.bucket from public.commission_sale_states_v2(p_reseller_id) c
  ), totals as (
    select coalesce(sum(c.reseller_commission) filter(where c.bucket='estimated'),0) as estimated,
      coalesce(sum(c.reseller_commission) filter(where c.bucket='available'),0) as available_gross from classified c
  ), adjustments as (
    select coalesce(sum(a.remaining_amount),0) as pending_adjustments from public.commission_adjustments a where a.reseller_id=p_reseller_id and a.status='pending'
  ), payments as (
    select coalesce(sum(p.net_paid) filter(where p.status='pending'),0) as liquidating,
      coalesce(sum(p.net_paid) filter(where p.status='paid'),0) as paid,
      coalesce(sum(p.net_paid) filter(where p.status='paid' and p.payment_date>=date_trunc('month',now() at time zone 'America/Asuncion')::date and p.payment_date<(date_trunc('month',now() at time zone 'America/Asuncion')+interval '1 month')::date),0) as paid_month
    from public.commission_payments p where p.reseller_id=p_reseller_id
  ) select jsonb_build_object('estimated',t.estimated,'available_gross',t.available_gross,
      'available',greatest(t.available_gross+a.pending_adjustments,0),'pending_adjustments',a.pending_adjustments,
      'liquidating',p.liquidating,'paid',p.paid,'paid_month',p.paid_month)
    from totals t cross join adjustments a cross join payments p;
$$;

create or replace function public.get_my_commission_balances_v2()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='reseller' and p.is_active) then raise exception 'Solo revendedores activos.'; end if;
  return public.commission_balances_v2(auth.uid());
end; $$;

create or replace function public.admin_commission_balances_v2()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administradores activos.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('reseller_id',p.id,'reseller_name',p.full_name,'reseller_code',p.reseller_code,
    'reseller_phone',p.phone,'has_bank_account',b.id is not null,'bank_name',b.bank_name,'bank_alias',b.bank_alias,'bank_holder',b.bank_holder)||public.commission_balances_v2(p.id)),'[]'::jsonb)
    into v_result from public.profiles p left join public.bank_accounts b on b.reseller_id=p.id and b.is_primary where p.role='reseller';
  return v_result;
end; $$;

create or replace function public.get_commission_sales_v2(p_reseller_id uuid default null,p_bucket text default 'available',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sesion requerida.'; end if;
  if public.is_admin() then v_id:=p_reseller_id;
  elsif exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='reseller' and p.is_active) then
    if p_reseller_id is not null and p_reseller_id<>auth.uid() then raise exception 'Acceso denegado.'; end if;
    v_id:=auth.uid();
  else raise exception 'Acceso denegado.'; end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into v_result from (
    select s.id,s.sale_number,s.product_name_snapshot,s.status,s.delivered_at,c.amount as reseller_commission,c.bucket
    from public.commission_sale_states_v2(v_id) c join public.sales s on s.id=c.sale_id
    where c.bucket=p_bucket order by s.delivered_at desc nulls last,s.id
    offset greatest(coalesce(p_offset,0),0) limit 50
  ) q;
  return v_result;
end; $$;

-- La tabla contiene cuentas internas agregadas en Fase 2. El reseller pasa a
-- una proyeccion explicita por RPC, manteniendo las policies admin existentes.
drop policy if exists "Resellers can read own commission payments" on public.commission_payments;
-- Las lecturas de ventas del panel ya pasan por RPC sanitizadas. RLS por fila
-- no oculta financial_account_id ni costos de una venta propia.
drop policy if exists "Resellers can read own sales" on public.sales;
create or replace function public.get_my_payment_receipts_v2(p_id uuid default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='reseller' and p.is_active) then raise exception 'Solo revendedores activos.'; end if;
  select coalesce(jsonb_agg(q.row),'[]'::jsonb) into v_result from (
    select jsonb_build_object('id',p.id,'batch_id',p.batch_id,'status',p.status,'gross_commission',p.gross_commission,
      'adjustments',p.adjustments,'discounts',p.discounts,'net_paid',p.net_paid,'payment_date',p.payment_date,
      'payment_method',p.payment_method,'voucher_url',p.voucher_url,'voucher_number',p.voucher_number,
      'bank_name_snapshot',p.bank_name_snapshot,'bank_alias_snapshot',p.bank_alias_snapshot,'bank_holder_snapshot',p.bank_holder_snapshot,
      'batch',jsonb_build_object('period_start',b.period_start,'period_end',b.period_end,'payment_day',b.payment_day,'status',b.status),
      'items',case when p_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'commission_amount_snapshot',i.commission_amount_snapshot,
        'sale',jsonb_build_object('id',s.id,'sale_number',s.sale_number,'product_name_snapshot',s.product_name_snapshot,'delivered_at',s.delivered_at)))
        from public.commission_payment_items i join public.sales s on s.id=i.sale_id where i.payment_id=p.id),'[]'::jsonb) end,
      'applied_adjustments',case when p_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'amount_applied',a.amount_applied,
        'adjustment',jsonb_build_object('reason',d.reason,'source_type',d.source_type))) from public.commission_payment_adjustments a join public.commission_adjustments d on d.id=a.adjustment_id where a.payment_id=p.id),'[]'::jsonb) end
    ) as row from public.commission_payments p join public.commission_batches b on b.id=p.batch_id
    where p.reseller_id=auth.uid() and (p_id is null or p.id=p_id)
    order by p.created_at desc,p.id offset greatest(coalesce(p_offset,0),0) limit 100
  ) q;
  return v_result;
end; $$;

-- Ningun campo privado de ventas o de cuentas Camaraza forma parte del JSON.
create or replace function public.get_my_operation_sales_v2(p_from date default null,p_to date default null,p_status text default null,p_search text default null,p_offset integer default 0,p_limit integer default 20,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='reseller' and p.is_active) then raise exception 'Solo revendedores activos.'; end if;
  if p_from>p_to then raise exception 'Rango de fechas invalido.'; end if;
  with filtered as (
    select s.* from public.sales s where s.reseller_id=auth.uid() and s.sale_type='reseller'
      and (p_id is null or s.id=p_id)
      and (p_from is null or s.operation_date>=p_from) and (p_to is null or s.operation_date<=p_to)
      and (nullif(p_status,'') is null or s.status=p_status)
      and (nullif(btrim(p_search),'') is null or strpos(lower(concat_ws(' ',s.product_name_snapshot,s.customer_name_snapshot,s.sale_number::text)),lower(left(btrim(p_search),100)))>0)
  ), page as (
    select jsonb_build_object('id',s.id,'sale_number',s.sale_number,'operation_date',s.operation_date,'status',s.status,
      'product_name_snapshot',s.product_name_snapshot,'customer_name',coalesce(s.customer_name_snapshot,c.full_name),
      'customer_phone_masked',case when coalesce(s.customer_phone_snapshot,c.phone) is null then null else '***'||right(coalesce(s.customer_phone_snapshot,c.phone),3) end,
      'delivery_city',s.delivery_city,'total_collected',s.total_collected,'product_sale_price',s.product_sale_price,'delivery_charged',s.delivery_charged,
      'reseller_commission',s.reseller_commission,'delivered_at',s.delivered_at,'created_at',s.created_at,
      'confirmed_at',s.confirmed_at,'dispatched_at',s.dispatched_at,
      'commission_paid',s.commission_paid,'commission_bucket',(select c.bucket from public.commission_sale_states_v2(auth.uid()) c where c.sale_id=s.id),
      'items',case when p_id is null then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(i)) from public.get_my_sale_items(s.id) i),'[]'::jsonb) end,
      'main_image_url',(select p.main_image_url from public.sale_items i join public.products p on p.id=i.product_id where i.sale_id=s.id order by i.sort_order,i.id limit 1)) as row
    from filtered s left join public.customers c on c.id=s.customer_id order by s.operation_date desc nulls last,s.created_at desc,s.id
    offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,20),1),100)
  ) select jsonb_build_object('rows',coalesce((select jsonb_agg(p.row) from page p),'[]'::jsonb),'total',(select count(*) from filtered)) into v_result;
  return v_result;
end; $$;

create or replace function public.get_my_operation_home_v2()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'America/Asuncion')::date; v_monday date; v_stats jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='reseller' and p.is_active) then raise exception 'Solo revendedores activos.'; end if;
  v_monday := v_today-(extract(isodow from v_today)::integer-1);
  select jsonb_agg(to_jsonb(q)) into v_stats from (
    select w.start_date,
      (select count(*) from public.sales o where o.reseller_id=auth.uid() and o.sale_type='reseller' and o.operation_date>=w.start_date and o.operation_date<w.start_date+7) as orders,
      (select count(*) from public.sales o where o.reseller_id=auth.uid() and o.sale_type='reseller' and o.operation_date>=w.start_date and o.operation_date<w.start_date+7 and o.status='out_for_delivery') as out_for_delivery,
      count(s.id) filter(where s.status='delivered_paid') as delivered,
      coalesce(sum(s.product_sale_price) filter(where s.status='delivered_paid'),0) as sales,
      coalesce(sum(s.reseller_commission) filter(where s.status='delivered_paid' and extract(isodow from s.delivered_at at time zone 'America/Asuncion') between 1 and 6),0) as commission
    from (values(v_monday),(v_monday-7)) w(start_date)
    left join public.sales s on s.reseller_id=auth.uid() and s.sale_type='reseller'
      and s.delivered_at >= w.start_date::timestamp at time zone 'America/Asuncion'
      and s.delivered_at < (w.start_date+7)::timestamp at time zone 'America/Asuncion'
    group by w.start_date order by w.start_date desc
  ) q;
  return jsonb_build_object('today',jsonb_build_object('rows',
    (public.get_my_operation_sales_v2(v_today,v_today,'confirmed',null,0,5)->'rows') ||
    (public.get_my_operation_sales_v2(v_today,v_today,'out_for_delivery',null,0,5)->'rows') ||
    (public.get_my_operation_sales_v2(v_today,v_today,'delivered_paid',null,0,5)->'rows')),
    'weeks',v_stats,'balances',public.commission_balances_v2(auth.uid()),
    'counts',(select jsonb_build_object('confirmed',count(*) filter(where s.status='confirmed'),'out_for_delivery',count(*) filter(where s.status='out_for_delivery'),'delivered_paid',count(*) filter(where s.status='delivered_paid')) from public.sales s where s.reseller_id=auth.uid() and s.operation_date=v_today));
end; $$;

create or replace function public.mark_commission_payment_paid(
  p_payment_id uuid,
  p_payment_date date,
  p_payment_method text default null,
  p_voucher_url text default null,
  p_voucher_number text default null,
  p_notes text default null,
  p_financial_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.commission_payments%rowtype;
  v_item_count integer;
  v_updated_count integer;
  v_movement_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can confirm commission payments';
  end if;
  if p_payment_date is null then
    raise exception 'payment_date is required';
  end if;

  select * into v_payment from public.commission_payments p where p.id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'Commission payment not found';
  end if;
  if v_payment.status = 'paid' then
    return p_payment_id;
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Only pending commission payments can be marked as paid';
  end if;
  if p_financial_account_id is null then
    raise exception 'Selecciona la cuenta desde la que se pago la comision.';
  end if;
  if not exists (select 1 from public.financial_accounts a where a.id = p_financial_account_id and a.is_active = true) then
    raise exception 'Financial account not found or inactive';
  end if;

  select count(*) into v_item_count from public.commission_payment_items item where item.payment_id = p_payment_id;
  if v_item_count = 0 then
    raise exception 'Cannot pay a commission payment without items';
  end if;

  -- Compensacion total por ajustes: no registrar un egreso ficticio de cero.
  if v_payment.net_paid > 0 then
  insert into public.financial_movements (
    account_id, movement_type, direction, amount, description, source_type, source_id, occurred_at, created_by
  )
  values (
    p_financial_account_id, 'commission_payment', 'expense', v_payment.net_paid,
    'Pago comision ' || p_payment_id::text, 'commission_payment', p_payment_id,
    p_payment_date::timestamp at time zone 'America/Asuncion', auth.uid()
  )
  on conflict (source_type, source_id, movement_type)
  where source_id is not null
    and movement_type in ('opening_balance', 'sale_income', 'commission_payment', 'expense', 'purchase_payment')
    and is_reversal = false
  do nothing
  returning id into v_movement_id;
  if v_movement_id is null then
    raise exception 'Ya existe un movimiento para esta liquidacion. Revisar consistencia antes de confirmar.';
  end if;
  end if;

  update public.commission_payments p
  set status = 'paid',
      payment_date = p_payment_date,
      payment_method = nullif(btrim(p_payment_method), ''),
      voucher_url = nullif(btrim(p_voucher_url), ''),
      voucher_number = nullif(btrim(p_voucher_number), ''),
      notes = coalesce(nullif(btrim(p_notes), ''), p.notes),
      financial_account_id = p_financial_account_id,
      financial_movement_id = v_movement_id,
      updated_at = now()
  where p.id = p_payment_id;

  update public.sales s
  set commission_paid = true,
      commission_paid_at = p_payment_date::timestamp at time zone 'America/Asuncion',
      commission_payment_id = p_payment_id,
      updated_at = now()
  where s.id in (select item.sale_id from public.commission_payment_items item where item.payment_id = p_payment_id)
    and s.sale_type = 'reseller'
    and s.status = 'delivered_paid'
    and s.commission_paid = false;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_item_count then
    raise exception 'All payment sales must be eligible when marking commission payment as paid';
  end if;

  insert into public.commission_events (batch_id, payment_id, actor_id, event_type, notes)
  values (v_payment.batch_id, p_payment_id, auth.uid(), 'payment_paid', p_notes);

  perform public.recalculate_commission_batch_status(v_payment.batch_id);
  return p_payment_id;
end;
$$;

-- Propietario/grants por firmas exactas.
do $$
declare v_signature text;
begin
  foreach v_signature in array array[
    'admin_set_collection_defaults(uuid,uuid)',
    'guard_financial_account_v2()',
    'admin_manage_account_v2(uuid,text,text,text)',
    'admin_save_sale_v2(uuid,jsonb)',
    'admin_operate_sale_v2(uuid,text,text,boolean)',
    'admin_search_sale_products_v2(text)',
    'admin_cash_day_v2(date)',
    'commission_balances_v2(uuid)',
    'commission_sale_states_v2(uuid)',
    'get_commission_sales_v2(uuid,text,integer)',
    'get_my_payment_receipts_v2(uuid,integer)',
    'get_my_commission_balances_v2()',
    'admin_commission_balances_v2()',
    'get_my_operation_sales_v2(date,date,text,text,integer,integer,uuid)',
    'get_my_operation_home_v2()'
    ,'mark_commission_payment_paid(uuid,date,text,text,text,text,uuid)'
  ] loop
    execute 'alter function public.'||v_signature||' owner to postgres';
    execute 'revoke all on function public.'||v_signature||' from public, anon, authenticated';
    if v_signature not in ('commission_balances_v2(uuid)','commission_sale_states_v2(uuid)','guard_financial_account_v2()') then
      execute 'grant execute on function public.'||v_signature||' to authenticated';
    end if;
  end loop;
end; $$;
notify pgrst, 'reload schema';
commit;
