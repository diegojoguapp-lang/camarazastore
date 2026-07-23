-- Camaraza Store Re-venta - Fase 5: objetivos, logros, actividad, rendimiento y busqueda admin.
-- No modifica datos historicos ni permite ventas creadas por revendedores.

begin;

create table if not exists public.reseller_goals (
  reseller_id uuid primary key references public.profiles(id) on delete cascade,
  weekly_sales_goal integer not null default 10,
  weekly_commission_goal numeric(14,2) not null default 500000,
  updated_at timestamptz not null default now(),
  constraint reseller_goals_values_check check (
    weekly_sales_goal >= 0
    and weekly_commission_goal >= 0
  )
);

create table if not exists public.reseller_achievements (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  progress numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  constraint reseller_achievements_unique unique (reseller_id, achievement_key)
);

create index if not exists reseller_achievements_reseller_id_idx on public.reseller_achievements(reseller_id);

alter table public.reseller_goals enable row level security;
alter table public.reseller_achievements enable row level security;

create or replace function public.prepare_reseller_goal_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.reseller_id
      and p.role = 'reseller'
      and p.is_active = true
  ) then
    raise exception 'Goals can be assigned only to an active reseller';
  end if;

  new.weekly_sales_goal := greatest(coalesce(new.weekly_sales_goal, 0), 0);
  new.weekly_commission_goal := greatest(coalesce(new.weekly_commission_goal, 0), 0);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reseller_goals_prepare_row on public.reseller_goals;
create trigger reseller_goals_prepare_row
before insert or update on public.reseller_goals
for each row execute function public.prepare_reseller_goal_row();

create or replace function public.my_current_period()
returns table (period_start date, period_end date, next_payment_date date)
language sql
stable
set search_path = ''
as $$
  select
    current_day - ((extract(isodow from current_day)::integer + 6) % 7) as period_start,
    current_day - ((extract(isodow from current_day)::integer + 6) % 7) + 5 as period_end,
    current_day - ((extract(isodow from current_day)::integer + 6) % 7) + 7 as next_payment_date
  from (
    select (now() at time zone 'America/Asuncion')::date as current_day
  ) d;
$$;

create or replace function public.get_my_goals()
returns table (
  weekly_sales_goal integer,
  weekly_commission_goal numeric,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authenticated session is required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'reseller' and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  insert into public.reseller_goals (reseller_id)
  values (v_uid)
  on conflict (reseller_id) do nothing;

  return query
  select g.weekly_sales_goal, g.weekly_commission_goal, g.updated_at
  from public.reseller_goals g
  where g.reseller_id = v_uid;
end;
$$;

create or replace function public.update_my_goals(
  p_weekly_sales_goal integer,
  p_weekly_commission_goal numeric
)
returns table (
  weekly_sales_goal integer,
  weekly_commission_goal numeric,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authenticated session is required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'reseller' and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  insert into public.reseller_goals (reseller_id, weekly_sales_goal, weekly_commission_goal)
  values (v_uid, greatest(coalesce(p_weekly_sales_goal, 0), 0), greatest(coalesce(p_weekly_commission_goal, 0), 0))
  on conflict (reseller_id) do update
  set weekly_sales_goal = excluded.weekly_sales_goal,
      weekly_commission_goal = excluded.weekly_commission_goal,
      updated_at = now();

  return query select * from public.get_my_goals();
end;
$$;

create or replace function public.sync_my_achievements()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_delivered_count integer;
  v_paid_count integer;
  v_historical_commission numeric;
  v_weekly_sales integer;
  v_weekly_goal integer;
  v_period_start date;
  v_period_end date;
begin
  if v_uid is null then
    raise exception 'Authenticated session is required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'reseller' and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  select period_start, period_end into v_period_start, v_period_end from public.my_current_period();

  select count(*), coalesce(sum(reseller_commission), 0)
  into v_delivered_count, v_historical_commission
  from public.sales
  where reseller_id = v_uid
    and status = 'delivered_paid';

  select count(*)
  into v_paid_count
  from public.commission_payments
  where reseller_id = v_uid
    and status = 'paid';

  select count(*)
  into v_weekly_sales
  from public.sales
  where reseller_id = v_uid
    and status = 'delivered_paid'
    and (delivered_at at time zone 'America/Asuncion')::date >= v_period_start
    and (delivered_at at time zone 'America/Asuncion')::date <= v_period_end;

  select coalesce(g.weekly_sales_goal, 10)
  into v_weekly_goal
  from public.reseller_goals g
  where g.reseller_id = v_uid;

  insert into public.reseller_achievements (reseller_id, achievement_key, progress)
  select v_uid, key, progress
  from (
    values
      ('first_sale', v_delivered_count),
      ('sales_5', v_delivered_count),
      ('sales_10', v_delivered_count),
      ('sales_25', v_delivered_count),
      ('sales_50', v_delivered_count),
      ('sales_100', v_delivered_count),
      ('first_paid_commission', v_paid_count),
      ('commission_500k', v_historical_commission),
      ('commission_1m', v_historical_commission),
      ('weekly_goal_completed', v_weekly_sales)
  ) as candidate(key, progress)
  where (
    (key = 'first_sale' and progress >= 1)
    or (key = 'sales_5' and progress >= 5)
    or (key = 'sales_10' and progress >= 10)
    or (key = 'sales_25' and progress >= 25)
    or (key = 'sales_50' and progress >= 50)
    or (key = 'sales_100' and progress >= 100)
    or (key = 'first_paid_commission' and progress >= 1)
    or (key = 'commission_500k' and progress >= 500000)
    or (key = 'commission_1m' and progress >= 1000000)
    or (key = 'weekly_goal_completed' and v_weekly_goal > 0 and progress >= v_weekly_goal)
  )
  on conflict (reseller_id, achievement_key) do update
  set progress = greatest(public.reseller_achievements.progress, excluded.progress);
end;
$$;

create or replace function public.get_my_achievements()
returns table (
  achievement_key text,
  title text,
  description text,
  target_value numeric,
  current_value numeric,
  unlocked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_delivered_count numeric;
  v_paid_count numeric;
  v_historical_commission numeric;
  v_weekly_sales numeric;
  v_period_start date;
  v_period_end date;
begin
  perform public.sync_my_achievements();

  if v_uid is null then
    raise exception 'Authenticated session is required';
  end if;

  select period_start, period_end into v_period_start, v_period_end from public.my_current_period();

  select count(*), coalesce(sum(reseller_commission), 0)
  into v_delivered_count, v_historical_commission
  from public.sales
  where reseller_id = v_uid and status = 'delivered_paid';

  select count(*) into v_paid_count
  from public.commission_payments
  where reseller_id = v_uid and status = 'paid';

  select count(*) into v_weekly_sales
  from public.sales
  where reseller_id = v_uid
    and status = 'delivered_paid'
    and (delivered_at at time zone 'America/Asuncion')::date >= v_period_start
    and (delivered_at at time zone 'America/Asuncion')::date <= v_period_end;

  return query
  with catalog as (
    select * from (values
      ('first_sale', 'Primera venta', 'Completa tu primera venta entregada.', 1::numeric, v_delivered_count),
      ('sales_5', '5 ventas', 'Alcanza 5 ventas entregadas.', 5::numeric, v_delivered_count),
      ('sales_10', '10 ventas', 'Alcanza 10 ventas entregadas.', 10::numeric, v_delivered_count),
      ('sales_25', '25 ventas', 'Alcanza 25 ventas entregadas.', 25::numeric, v_delivered_count),
      ('sales_50', '50 ventas', 'Alcanza 50 ventas entregadas.', 50::numeric, v_delivered_count),
      ('sales_100', '100 ventas', 'Alcanza 100 ventas entregadas.', 100::numeric, v_delivered_count),
      ('first_paid_commission', 'Primera comision cobrada', 'Recibe tu primer pago de comision.', 1::numeric, v_paid_count),
      ('commission_500k', '500.000 Gs generados', 'Genera 500.000 Gs en comisiones.', 500000::numeric, v_historical_commission),
      ('commission_1m', '1.000.000 Gs generados', 'Genera 1.000.000 Gs en comisiones.', 1000000::numeric, v_historical_commission),
      ('weekly_goal_completed', 'Objetivo semanal completado', 'Completa tu objetivo semanal de ventas.', coalesce((select weekly_sales_goal from public.reseller_goals where reseller_id = v_uid), 10)::numeric, v_weekly_sales),
      ('four_active_weeks', '4 semanas con ventas', 'Completa cuatro semanas con al menos una venta.', 4::numeric, 0::numeric)
    ) as c(key, title, description, target_value, current_value)
  )
  select
    c.key,
    c.title,
    c.description,
    c.target_value,
    c.current_value,
    a.unlocked_at
  from catalog c
  left join public.reseller_achievements a
    on a.reseller_id = v_uid
    and a.achievement_key = c.key
  order by a.unlocked_at nulls last, c.target_value;
end;
$$;

create or replace function public.get_my_activity(p_limit integer default 30)
returns table (
  activity_id text,
  activity_type text,
  title text,
  detail text,
  amount numeric,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 80);
begin
  if v_uid is null then
    raise exception 'Authenticated session is required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'reseller' and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  perform public.sync_my_achievements();

  return query
  select *
  from (
    select
      se.id::text as activity_id,
      'sale'::text as activity_type,
      case
        when se.event_type = 'sale_created' then 'Pedido registrado'
        when se.event_type = 'status_changed' then 'Pedido cambio de estado'
        else 'Actividad de pedido'
      end as title,
      s.product_name_snapshot || ' - ' || coalesce(se.to_status, s.status) as detail,
      s.reseller_commission as amount,
      se.created_at
    from public.sale_events se
    join public.sales s on s.id = se.sale_id
    where s.reseller_id = v_uid

    union all

    select
      cp.id::text,
      'payment'::text,
      'Pago registrado',
      coalesce(cp.bank_name_snapshot, 'Pago de comision') || ' - ' || cp.status,
      cp.net_paid,
      cp.updated_at
    from public.commission_payments cp
    where cp.reseller_id = v_uid

    union all

    select
      ra.id::text,
      'achievement'::text,
      'Logro desbloqueado',
      ra.achievement_key,
      ra.progress,
      ra.unlocked_at
    from public.reseller_achievements ra
    where ra.reseller_id = v_uid
  ) activity
  order by activity.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.get_my_performance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  result jsonb;
begin
  if v_uid is null then
    raise exception 'Authenticated session is required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'reseller' and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  with own_sales as (
    select *
    from public.sales s
    where s.reseller_id = v_uid
  ),
  delivered as (
    select * from own_sales where status = 'delivered_paid' and delivered_at is not null
  ),
  weekly as (
    select
      date_trunc('week', delivered_at at time zone 'America/Asuncion')::date as week_start,
      count(*) as sales_count,
      coalesce(sum(reseller_commission), 0) as commission
    from delivered
    group by 1
    order by 1 desc
    limit 8
  ),
  product_stats as (
    select product_name_snapshot, count(*) as qty
    from delivered
    group by product_name_snapshot
    order by qty desc, product_name_snapshot asc
    limit 1
  ),
  current_week as (
    select (now() at time zone 'America/Asuncion')::date - ((extract(isodow from (now() at time zone 'America/Asuncion')::date)::integer + 6) % 7) as week_start
  ),
  streak_weeks as (
    select
      gs.n,
      cw.week_start - (gs.n * 7) as week_start,
      cw.week_start - (gs.n * 7) + 6 as week_end_exclusive
    from current_week cw
    cross join generate_series(0, 52) as gs(n)
  ),
  streak_hits as (
    select
      sw.n,
      exists (
        select 1
        from delivered d
        where (d.delivered_at at time zone 'America/Asuncion')::date >= sw.week_start
          and (d.delivered_at at time zone 'America/Asuncion')::date < sw.week_end_exclusive
      ) as has_sale
    from streak_weeks sw
  ),
  streak_result as (
    select coalesce(min(n) filter (where has_sale = false), 53) as current_sales_week_streak
    from streak_hits
  )
  select jsonb_build_object(
    'total_sales', (select count(*) from own_sales),
    'delivered_sales', (select count(*) from delivered),
    'sales_last_7_days', (
      select count(*)
      from delivered
      where delivered_at >= (((now() at time zone 'America/Asuncion') - interval '7 days') at time zone 'America/Asuncion')
    ),
    'sales_last_30_days', (
      select count(*)
      from delivered
      where delivered_at >= (((now() at time zone 'America/Asuncion') - interval '30 days') at time zone 'America/Asuncion')
    ),
    'generated_commission', (select coalesce(sum(reseller_commission), 0) from delivered),
    'paid_commission', (select coalesce(sum(net_paid), 0) from public.commission_payments where reseller_id = v_uid and status = 'paid'),
    'pending_commission', (select coalesce(sum(reseller_commission), 0) from delivered where commission_paid = false),
    'average_commission', (select coalesce(avg(reseller_commission), 0) from delivered),
    'first_sale_at', (select min(delivered_at) from delivered),
    'last_sale_at', (select max(delivered_at) from delivered),
    'top_product', (select product_name_snapshot from product_stats),
    'best_week_sales', (select coalesce(max(sales_count), 0) from weekly),
    'current_sales_week_streak', (select current_sales_week_streak from streak_result),
    'cancelled_or_failed', (select count(*) from own_sales where status in ('cancelled', 'failed_delivery', 'returned')),
    'success_rate', (
      select case when count(*) = 0 then 0 else round(100 * count(*) filter (where status = 'delivered_paid')::numeric / count(*), 1) end
      from own_sales where status in ('delivered_paid', 'cancelled', 'failed_delivery', 'returned')
    ),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('week_start', week_start, 'sales', sales_count, 'commission', commission) order by week_start), '[]'::jsonb) from weekly)
  )
  into result;

  return result;
end;
$$;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Asuncion')::date;
  week_start date := (now() at time zone 'America/Asuncion')::date - ((extract(isodow from (now() at time zone 'America/Asuncion')::date)::integer + 6) % 7);
  month_start date := date_trunc('month', now() at time zone 'America/Asuncion')::date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can read dashboard';
  end if;

  with sales_local as (
    select
      s.*,
      (s.created_at at time zone 'America/Asuncion')::date as created_day,
      (s.delivered_at at time zone 'America/Asuncion')::date as delivered_day
    from public.sales s
  )
  select jsonb_build_object(
    'sales_today', (select coalesce(count(*), 0) from sales_local where created_day = today),
    'sales_yesterday', (select coalesce(count(*), 0) from sales_local where created_day = today - 1),
    'sales_this_week', (select coalesce(count(*), 0) from sales_local where created_day >= week_start),
    'sales_this_month', (select coalesce(count(*), 0) from sales_local where created_day >= month_start),
    'gross_revenue', (select coalesce(sum(total_collected), 0) from sales_local where status = 'delivered_paid'),
    'net_profit', (select coalesce(sum(camaraza_net_profit), 0) from sales_local where status = 'delivered_paid'),
    'pending_commissions', (select coalesce(sum(reseller_commission), 0) from sales_local where status = 'delivered_paid' and commission_paid = false),
    'paid_commissions', (select coalesce(sum(net_paid), 0) from public.commission_payments where status = 'paid'),
    'pending_contact', (select coalesce(count(*), 0) from sales_local where status = 'pending_contact'),
    'confirmed', (select coalesce(count(*), 0) from sales_local where status = 'confirmed'),
    'preparing', (select coalesce(count(*), 0) from sales_local where status = 'preparing'),
    'out_for_delivery', (select coalesce(count(*), 0) from sales_local where status = 'out_for_delivery'),
    'delivered_today', (select coalesce(count(*), 0) from sales_local where status = 'delivered_paid' and delivered_day = today),
    'cancelled_or_failed', (select coalesce(count(*), 0) from sales_local where status in ('cancelled', 'failed_delivery')),
    'active_resellers', (select coalesce(count(*), 0) from public.profiles where role = 'reseller' and is_active = true),
    'resellers_with_sales_this_week', (select coalesce(count(distinct reseller_id), 0) from sales_local where created_day >= week_start),
    'total_customers', (select coalesce(count(*), 0) from public.customers),
    'pending_payments', (select coalesce(count(*), 0) from public.commission_payments where status = 'pending'),
    'batches_open', (select coalesce(count(*), 0) from public.commission_batches where status in ('draft', 'ready')),
    'resellers_without_bank', (
      select coalesce(count(*), 0)
      from public.profiles p
      where p.role = 'reseller'
        and p.is_active = true
        and not exists (select 1 from public.bank_accounts b where b.reseller_id = p.id)
    )
  )
  into result;

  return result;
end;
$$;

create or replace function public.admin_global_search(p_term text)
returns table (
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  term text := btrim(coalesce(p_term, ''));
begin
  if not public.is_admin() then
    raise exception 'Only admins can search';
  end if;

  if length(term) < 2 then
    return;
  end if;

  return query
  with reseller_results as (
    select 'revendedor'::text as result_type, p.id as result_id, coalesce(p.reseller_code, '-') || ' - ' || coalesce(p.full_name, p.email) as title, p.email as subtitle, '/admin/revendedores'::text as path
    from public.profiles p
    where p.role = 'reseller'
      and (p.full_name ilike '%' || term || '%' or p.email ilike '%' || term || '%' or p.reseller_code ilike '%' || term || '%')
    limit 6
  ),
  customer_results as (
    select 'cliente'::text as result_type, c.id as result_id, c.full_name as title, c.phone as subtitle, '/admin/clientes/' || c.id::text as path
    from public.customers c
    where c.full_name ilike '%' || term || '%' or c.phone ilike '%' || term || '%'
    limit 6
  ),
  sale_results as (
    select 'venta'::text as result_type, s.id as result_id, s.product_name_snapshot as title, s.status as subtitle, '/admin/ventas/' || s.id::text as path
    from public.sales s
    where s.product_name_snapshot ilike '%' || term || '%'
    limit 6
  ),
  product_results as (
    select 'producto'::text as result_type, pr.id as result_id, pr.name as title, pr.slug as subtitle, '/admin/productos/' || pr.id::text || '/editar' as path
    from public.products pr
    where pr.name ilike '%' || term || '%' or pr.slug ilike '%' || term || '%'
    limit 6
  ),
  payment_results as (
    select 'pago'::text as result_type, cp.id as result_id, 'Pago ' || cp.id::text as title, cp.status || ' - ' || cp.net_paid::text as subtitle, '/admin/comisiones/pagos/' || cp.id::text as path
    from public.commission_payments cp
    where cp.id::text ilike '%' || term || '%'
    limit 6
  )
  select * from reseller_results
  union all select * from customer_results
  union all select * from sale_results
  union all select * from product_results
  union all select * from payment_results
  limit 25;
end;
$$;

alter function public.prepare_reseller_goal_row() owner to postgres;
alter function public.my_current_period() owner to postgres;
alter function public.get_my_goals() owner to postgres;
alter function public.update_my_goals(integer, numeric) owner to postgres;
alter function public.sync_my_achievements() owner to postgres;
alter function public.get_my_achievements() owner to postgres;
alter function public.get_my_activity(integer) owner to postgres;
alter function public.get_my_performance() owner to postgres;
alter function public.get_admin_dashboard() owner to postgres;
alter function public.admin_global_search(text) owner to postgres;

revoke all on function public.get_my_goals() from public;
revoke all on function public.my_current_period() from public;
revoke all on function public.update_my_goals(integer, numeric) from public;
revoke all on function public.sync_my_achievements() from public;
revoke all on function public.get_my_achievements() from public;
revoke all on function public.get_my_activity(integer) from public;
revoke all on function public.get_my_performance() from public;
revoke all on function public.get_admin_dashboard() from public;
revoke all on function public.admin_global_search(text) from public;

grant execute on function public.get_my_goals() to authenticated;
grant execute on function public.my_current_period() to authenticated;
grant execute on function public.update_my_goals(integer, numeric) to authenticated;
grant execute on function public.get_my_achievements() to authenticated;
grant execute on function public.get_my_activity(integer) to authenticated;
grant execute on function public.get_my_performance() to authenticated;
grant execute on function public.get_admin_dashboard() to authenticated;
grant execute on function public.admin_global_search(text) to authenticated;

drop policy if exists "Admins can read reseller goals" on public.reseller_goals;
create policy "Admins can read reseller goals"
on public.reseller_goals for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own goals" on public.reseller_goals;
create policy "Resellers can read own goals"
on public.reseller_goals for select to authenticated
using (reseller_id = auth.uid());

drop policy if exists "Resellers can insert own goals" on public.reseller_goals;
create policy "Resellers can insert own goals"
on public.reseller_goals for insert to authenticated
with check (reseller_id = auth.uid());

drop policy if exists "Resellers can update own goals" on public.reseller_goals;
create policy "Resellers can update own goals"
on public.reseller_goals for update to authenticated
using (reseller_id = auth.uid())
with check (reseller_id = auth.uid());

drop policy if exists "Admins can read reseller achievements" on public.reseller_achievements;
create policy "Admins can read reseller achievements"
on public.reseller_achievements for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own achievements" on public.reseller_achievements;
create policy "Resellers can read own achievements"
on public.reseller_achievements for select to authenticated
using (reseller_id = auth.uid());

notify pgrst, 'reload schema';

commit;
