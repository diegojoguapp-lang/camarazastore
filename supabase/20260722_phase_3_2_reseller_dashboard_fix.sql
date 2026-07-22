-- Camaraza Store Re-venta - Fase 3.2: dashboard seguro del revendedor.
-- Corrige el seguimiento del panel sin dar SELECT libre sobre public.customers.
-- No modifica ventas existentes ni recalcula datos historicos.

begin;

create or replace function public.get_my_sales(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  sale_id uuid,
  product_name text,
  product_model text,
  quantity integer,
  status text,
  reseller_visible_notes text,
  product_sale_price numeric,
  delivery_charged numeric,
  total_collected numeric,
  reseller_commission numeric,
  ordered_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz,
  delivery_city text,
  customer_name text,
  customer_phone_masked text,
  customer_city text,
  commission_paid boolean,
  commission_paid_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'Authenticated reseller session is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role = 'reseller'
      and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  return query
  select
    s.id as sale_id,
    s.product_name_snapshot as product_name,
    s.product_model_snapshot as product_model,
    s.quantity,
    s.status,
    s.reseller_visible_notes,
    s.product_sale_price,
    s.delivery_charged,
    s.total_collected,
    s.reseller_commission,
    s.ordered_at,
    s.delivered_at,
    s.created_at,
    s.delivery_city,
    c.full_name as customer_name,
    case
      when length(public.normalize_customer_phone(c.phone)) <= 5 then '***'
      else
        left(public.normalize_customer_phone(c.phone), 3)
        || '*****'
        || right(public.normalize_customer_phone(c.phone), 2)
    end as customer_phone_masked,
    c.city as customer_city,
    coalesce(s.commission_paid, false) as commission_paid,
    s.commission_paid_at
  from public.sales s
  join public.customers c on c.id = s.customer_id
  where s.reseller_id = v_uid
    and (p_status is null or s.status = p_status)
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or s.product_name_snapshot ilike '%' || btrim(p_search) || '%'
    )
    and (
      p_date_from is null
      or (s.delivered_at at time zone 'America/Asuncion')::date >= p_date_from
    )
    and (
      p_date_to is null
      or (s.delivered_at at time zone 'America/Asuncion')::date <= p_date_to
    )
  order by s.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.get_my_reseller_dashboard()
returns table (
  estimated_commission numeric,
  unpaid_confirmed_commission numeric,
  current_period_commission numeric,
  current_period_delivered_sales bigint,
  total_delivered_sales bigint,
  total_historical_commission numeric,
  total_paid_commission numeric,
  total_pending_payments numeric,
  next_payment_date date,
  current_period_start date,
  current_period_end date,
  pending_contact_sales bigint,
  confirmed_sales bigint,
  preparing_sales bigint,
  out_for_delivery_sales bigint,
  cancelled_or_failed_sales bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Asuncion')::date;
  v_period_start date;
  v_period_end date;
begin
  if v_uid is null then
    raise exception 'Authenticated reseller session is required';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role = 'reseller'
      and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  v_period_start := v_today - ((extract(isodow from v_today)::integer + 6) % 7);
  v_period_end := v_period_start + 5;

  return query
  with own_sales as (
    select
      s.status,
      s.reseller_commission,
      coalesce(s.commission_paid, false) as commission_paid,
      (s.delivered_at at time zone 'America/Asuncion')::date as delivered_date
    from public.sales s
    where s.reseller_id = v_uid
  ),
  payment_totals as (
    select
      coalesce(sum(p.net_paid) filter (where p.status = 'paid'), 0) as paid_total,
      coalesce(sum(p.net_paid) filter (where p.status = 'pending'), 0) as pending_total
    from public.commission_payments p
    where p.reseller_id = v_uid
  ),
  sales_totals as (
    select
      coalesce(sum(os.reseller_commission) filter (
        where os.status in ('confirmed', 'preparing', 'out_for_delivery')
      ), 0) as estimated_commission,
      coalesce(sum(os.reseller_commission) filter (
        where os.status = 'delivered_paid'
          and os.commission_paid = false
      ), 0) as unpaid_confirmed_commission,
      coalesce(sum(os.reseller_commission) filter (
        where os.status = 'delivered_paid'
          and os.delivered_date >= v_period_start
          and os.delivered_date < v_period_start + 6
          and extract(isodow from os.delivered_date) between 1 and 6
      ), 0) as current_period_commission,
      count(*) filter (
        where os.status = 'delivered_paid'
          and os.delivered_date >= v_period_start
          and os.delivered_date < v_period_start + 6
          and extract(isodow from os.delivered_date) between 1 and 6
      ) as current_period_delivered_sales,
      count(*) filter (where os.status = 'delivered_paid') as total_delivered_sales,
      coalesce(sum(os.reseller_commission) filter (
        where os.status = 'delivered_paid'
      ), 0) as total_historical_commission,
      count(*) filter (where os.status = 'pending_contact') as pending_contact_sales,
      count(*) filter (where os.status = 'confirmed') as confirmed_sales,
      count(*) filter (where os.status = 'preparing') as preparing_sales,
      count(*) filter (where os.status = 'out_for_delivery') as out_for_delivery_sales,
      count(*) filter (where os.status in ('cancelled', 'failed_delivery', 'returned')) as cancelled_or_failed_sales
    from own_sales os
  )
  select
    st.estimated_commission,
    st.unpaid_confirmed_commission,
    st.current_period_commission,
    st.current_period_delivered_sales,
    st.total_delivered_sales,
    st.total_historical_commission,
    pt.paid_total as total_paid_commission,
    pt.pending_total as total_pending_payments,
    v_period_start + 7 as next_payment_date,
    v_period_start as current_period_start,
    v_period_end as current_period_end,
    st.pending_contact_sales,
    st.confirmed_sales,
    st.preparing_sales,
    st.out_for_delivery_sales,
    st.cancelled_or_failed_sales
  from sales_totals st
  cross join payment_totals pt;
end;
$$;

alter function public.get_my_sales(text, text, integer, integer, date, date) owner to postgres;
alter function public.get_my_reseller_dashboard() owner to postgres;

revoke all on function public.get_my_sales(text, text, integer, integer, date, date) from public;
revoke all on function public.get_my_reseller_dashboard() from public;

grant execute on function public.get_my_sales(text, text, integer, integer, date, date) to authenticated;
grant execute on function public.get_my_reseller_dashboard() to authenticated;

comment on function public.get_my_sales(text, text, integer, integer, date, date)
is 'Devuelve ventas sanitizadas del revendedor autenticado sin exponer datos sensibles de customers ni costos internos.';

comment on function public.get_my_reseller_dashboard()
is 'Devuelve resumen del dashboard del revendedor autenticado usando delivered_at y periodo lunes-sabado America/Asuncion.';

notify pgrst, 'reload schema';

commit;
