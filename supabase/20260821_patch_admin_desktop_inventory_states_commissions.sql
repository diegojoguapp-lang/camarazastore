begin;

create or replace function public.admin_transition_sale_status(
  p_sale_id uuid,
  p_status text,
  p_notes text default null,
  p_financial_account_id uuid default null,
  p_payment_method text default null
)
returns table (
  id uuid,
  status text,
  delivered_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_new_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_old_status text;
  v_reserved_states text[] := array['confirmed', 'preparing', 'out_for_delivery'];
begin
  if not public.is_admin() then
    raise exception 'Only active admins can update sales';
  end if;

  if v_new_status not in ('pending_contact','confirmed','preparing','out_for_delivery','delivered_paid','cancelled','failed_delivery','returned') then
    raise exception 'Invalid sale status';
  end if;

  select * into v_sale
  from public.sales s
  where s.id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;

  v_old_status := v_sale.status;

  if v_old_status = 'returned' and v_new_status <> 'returned' then
    raise exception 'Returned sales cannot be reopened';
  end if;

  if v_old_status = 'delivered_paid' and v_new_status not in ('delivered_paid', 'returned') then
    raise exception 'Delivered sales can only move to returned';
  end if;

  if v_new_status = v_old_status then
    return query select v_sale.id, v_sale.status, v_sale.delivered_at, v_sale.paid_at;
    return;
  end if;

  if v_new_status = any(v_reserved_states) then
    if v_old_status = any(v_reserved_states) then
      update public.sales s
      set status = v_new_status,
          updated_at = now()
      where s.id = p_sale_id
      returning s.* into v_sale;
    else
      update public.sales s
      set status = v_new_status,
          updated_at = now()
      where s.id = p_sale_id
      returning s.* into v_sale;

      perform public.admin_reserve_sale_stock(p_sale_id);
      select * into v_sale from public.sales s where s.id = p_sale_id;
    end if;
  elsif v_new_status in ('pending_contact', 'cancelled', 'failed_delivery') then
    if v_old_status = any(v_reserved_states) then
      perform public.admin_release_sale_stock(p_sale_id);
    end if;

    update public.sales s
    set status = v_new_status,
        updated_at = now()
    where s.id = p_sale_id
    returning s.* into v_sale;
  elsif v_new_status = 'delivered_paid' then
    if p_financial_account_id is null or nullif(btrim(coalesce(p_payment_method, '')), '') is null then
      raise exception 'Para entregar y cobrar selecciona metodo de pago y cuenta financiera.';
    end if;

    if v_old_status <> all(v_reserved_states) then
      update public.sales s
      set status = 'confirmed',
          updated_at = now()
      where s.id = p_sale_id
      returning s.* into v_sale;

      perform public.admin_reserve_sale_stock(p_sale_id);
    end if;

    perform public.admin_consume_sale_stock(p_sale_id);

    update public.sales s
    set status = 'delivered_paid',
        updated_at = now()
    where s.id = p_sale_id
    returning s.* into v_sale;

    perform public.admin_create_sale_income(p_sale_id, p_financial_account_id, p_payment_method);
    select * into v_sale from public.sales s where s.id = p_sale_id;
  elsif v_new_status = 'returned' then
    if v_old_status <> 'delivered_paid' then
      raise exception 'Solo una venta entregada y cobrada puede pasar a devuelta.';
    end if;

    perform public.admin_return_sale_stock(p_sale_id);

    update public.sales s
    set status = 'returned',
        updated_at = now()
    where s.id = p_sale_id
    returning s.* into v_sale;

    perform public.admin_reverse_sale_income(p_sale_id);
  end if;

  if nullif(btrim(coalesce(p_notes, '')), '') is not null then
    insert into public.sale_events (sale_id, actor_id, event_type, from_status, to_status, notes)
    values (p_sale_id, auth.uid(), 'status_note', v_old_status, v_new_status, nullif(btrim(p_notes), ''));
  end if;

  return query select v_sale.id, v_sale.status, v_sale.delivered_at, v_sale.paid_at;
end;
$$;

create or replace function public.admin_create_inventory_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_reason text,
  p_notes text default null,
  p_location_id uuid default null,
  p_unit_cost_snapshot numeric default null,
  p_source_type text default 'manual',
  p_source_id uuid default null
)
returns table (
  movement_id uuid,
  product_id uuid,
  location_id uuid,
  movement_type text,
  quantity_delta integer,
  stock_before integer,
  stock_after integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_stock_before integer;
  v_reserved integer;
  v_stock_after integer;
  v_delta integer;
  v_location_id uuid;
  v_track_inventory boolean;
  v_product_cost numeric(14,2);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_clean_source_type text := coalesce(nullif(btrim(p_source_type), ''), 'manual');
  v_movement_id uuid;
  v_created_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can manage inventory';
  end if;

  if p_product_id is null then
    raise exception 'Producto no encontrado.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_movement_type not in ('opening_balance', 'manual_entry', 'manual_exit', 'adjustment_in', 'adjustment_out', 'damaged', 'lost') then
    raise exception 'Invalid manual inventory movement type';
  end if;

  if v_reason is null then
    raise exception 'Movement reason is required';
  end if;

  select coalesce(p.stock_quantity, 0), coalesce(p.reserved_stock_quantity, 0), coalesce(p.cost_price, 0)
  into v_stock_before, v_reserved, v_product_cost
  from public.products p
  where p.id = p_product_id
  for update;

  if v_stock_before is null then
    raise exception 'Producto no encontrado.';
  end if;

  if p_movement_type = 'opening_balance' and v_stock_before <> 0 then
    raise exception 'Opening balance can only be used when current stock is zero';
  end if;

  v_delta := case
    when p_movement_type in ('opening_balance', 'manual_entry', 'adjustment_in') then p_quantity
    else -p_quantity
  end;

  insert into public.product_admin_details (product_id)
  values (p_product_id)
  on conflict (product_id) do nothing;

  select d.track_inventory
  into v_track_inventory
  from public.product_admin_details d
  where d.product_id = p_product_id;

  if v_track_inventory = false then
    raise exception 'Inventory tracking is disabled for this product';
  end if;

  select l.id
  into v_location_id
  from public.inventory_locations l
  where (p_location_id is null or l.id = p_location_id)
    and l.is_active = true
  order by l.is_default desc, l.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Active inventory location not found';
  end if;

  v_stock_after := v_stock_before + v_delta;
  if v_stock_after < 0 then
    raise exception 'Inventory movement would leave negative stock';
  end if;
  if v_stock_after < v_reserved then
    raise exception 'Inventory movement would leave stock below reserved quantity';
  end if;

  insert into public.inventory_movements (
    product_id, location_id, movement_type, quantity_delta, stock_before, stock_after,
    unit_cost_snapshot, reason, notes, source_type, source_id, created_by
  )
  values (
    p_product_id, v_location_id, p_movement_type, v_delta, v_stock_before, v_stock_after,
    coalesce(p_unit_cost_snapshot, v_product_cost), v_reason, nullif(btrim(coalesce(p_notes, '')), ''),
    v_clean_source_type, p_source_id, v_uid
  )
  returning id, inventory_movements.created_at into v_movement_id, v_created_at;

  update public.products p
  set stock_quantity = v_stock_after,
      updated_at = now()
  where p.id = p_product_id;

  return query select v_movement_id, p_product_id, v_location_id, p_movement_type, v_delta, v_stock_before, v_stock_after, v_created_at;
end;
$$;

create or replace function public.admin_commission_period_bounds(
  p_period text default 'this_week',
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  start_date date,
  end_exclusive date,
  period_label text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Asuncion')::date;
  v_monday date;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view commission periods';
  end if;

  v_monday := v_today - (extract(isodow from v_today)::integer - 1);

  if coalesce(p_period, 'this_week') = 'today' then
    start_date := v_today;
    end_exclusive := v_today + 1;
  elsif coalesce(p_period, 'this_week') = 'last_week' then
    start_date := v_monday - 7;
    end_exclusive := v_monday - 1;
  elsif coalesce(p_period, 'this_week') = 'custom' then
    start_date := coalesce(p_date_from, v_monday);
    end_exclusive := coalesce(p_date_to, start_date) + 1;
  else
    start_date := v_monday;
    end_exclusive := v_monday + 6;
  end if;

  period_label := to_char(start_date, 'DD/MM/YYYY') || ' al ' || to_char(end_exclusive - 1, 'DD/MM/YYYY');
  return next;
end;
$$;

create or replace function public.admin_get_reseller_commission_overview(
  p_period text default 'this_week',
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  reseller_id uuid,
  reseller_code text,
  reseller_name text,
  reseller_phone text,
  period_label text,
  period_sales_count bigint,
  today_commission numeric,
  pending_commission numeric,
  paid_month_commission numeric,
  pending_adjustments numeric,
  has_bank_account boolean,
  bank_name text,
  bank_alias text,
  bank_account_number text,
  bank_holder text,
  can_pay boolean,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
  v_label text;
  v_today date := (now() at time zone 'America/Asuncion')::date;
  v_month_start date := date_trunc('month', now() at time zone 'America/Asuncion')::date;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view reseller commissions';
  end if;

  select b.start_date, b.end_exclusive, b.period_label
  into v_start, v_end, v_label
  from public.admin_commission_period_bounds(p_period, p_date_from, p_date_to) b;

  return query
  with period_sales as (
    select
      s.reseller_id,
      count(*) as sales_count,
      coalesce(sum(s.reseller_commission), 0) as pending_total
    from public.sales s
    where s.sale_type = 'reseller'
      and s.status = 'delivered_paid'
      and coalesce(s.commission_paid, false) = false
      and s.delivered_at is not null
      and (s.delivered_at at time zone 'America/Asuncion')::date >= v_start
      and (s.delivered_at at time zone 'America/Asuncion')::date < v_end
      and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) between 1 and 6
    group by s.reseller_id
  ),
  today_sales as (
    select s.reseller_id, coalesce(sum(s.reseller_commission), 0) as today_total
    from public.sales s
    where s.sale_type = 'reseller'
      and s.status = 'delivered_paid'
      and s.delivered_at is not null
      and (s.delivered_at at time zone 'America/Asuncion')::date = v_today
      and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) between 1 and 6
    group by s.reseller_id
  ),
  paid_month as (
    select cp.reseller_id, coalesce(sum(cp.net_paid), 0) as paid_total
    from public.commission_payments cp
    where cp.status = 'paid'
      and cp.payment_date >= v_month_start
    group by cp.reseller_id
  ),
  adjustments as (
    select ca.reseller_id, coalesce(sum(ca.remaining_amount), 0) as adjustment_total
    from public.commission_adjustments ca
    where ca.status = 'pending'
    group by ca.reseller_id
  )
  select
    p.id,
    p.reseller_code,
    p.full_name,
    p.phone,
    v_label,
    coalesce(ps.sales_count, 0),
    coalesce(ts.today_total, 0),
    coalesce(ps.pending_total, 0),
    coalesce(pm.paid_total, 0),
    coalesce(ad.adjustment_total, 0),
    ba.id is not null,
    ba.bank_name,
    ba.bank_alias,
    ba.bank_document,
    ba.bank_holder,
    ba.id is not null and coalesce(ps.pending_total, 0) > 0,
    case
      when ba.id is null then 'Sin cuenta bancaria'
      when coalesce(ps.pending_total, 0) <= 0 then 'Sin comision pendiente'
      else 'Listo para pagar'
    end
  from public.profiles p
  left join period_sales ps on ps.reseller_id = p.id
  left join today_sales ts on ts.reseller_id = p.id
  left join paid_month pm on pm.reseller_id = p.id
  left join adjustments ad on ad.reseller_id = p.id
  left join public.bank_accounts ba on ba.reseller_id = p.id and ba.is_primary = true
  where p.role = 'reseller'
    and p.is_active = true
    and (
      coalesce(ps.sales_count, 0) > 0
      or coalesce(ts.today_total, 0) > 0
      or coalesce(pm.paid_total, 0) > 0
      or coalesce(ad.adjustment_total, 0) <> 0
    )
  order by coalesce(ps.pending_total, 0) desc, p.full_name asc;
end;
$$;

create or replace function public.admin_get_reseller_commission_detail(
  p_reseller_id uuid,
  p_period text default 'this_week',
  p_date_from date default null,
  p_date_to date default null
)
returns table (
  sale_id uuid,
  sale_item_id uuid,
  delivered_at timestamptz,
  product_name text,
  quantity integer,
  line_commission numeric,
  sale_commission numeric,
  paid boolean,
  payment_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view reseller commission detail';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_reseller_id and p.role = 'reseller') then
    raise exception 'Reseller not found';
  end if;

  select b.start_date, b.end_exclusive
  into v_start, v_end
  from public.admin_commission_period_bounds(p_period, p_date_from, p_date_to) b;

  return query
  select
    s.id,
    i.id,
    s.delivered_at,
    i.product_name_snapshot,
    i.quantity,
    i.line_commission_total,
    s.reseller_commission,
    coalesce(s.commission_paid, false),
    s.commission_payment_id
  from public.sales s
  join public.sale_items i on i.sale_id = s.id
  where s.reseller_id = p_reseller_id
    and s.sale_type = 'reseller'
    and s.status = 'delivered_paid'
    and s.delivered_at is not null
    and (s.delivered_at at time zone 'America/Asuncion')::date >= v_start
    and (s.delivered_at at time zone 'America/Asuncion')::date < v_end
    and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) between 1 and 6
  order by s.delivered_at asc, i.sort_order asc, i.id asc;
end;
$$;

alter function public.admin_transition_sale_status(uuid, text, text, uuid, text) owner to postgres;
alter function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) owner to postgres;
alter function public.admin_commission_period_bounds(text, date, date) owner to postgres;
alter function public.admin_get_reseller_commission_overview(text, date, date) owner to postgres;
alter function public.admin_get_reseller_commission_detail(uuid, text, date, date) owner to postgres;

revoke all on function public.admin_transition_sale_status(uuid, text, text, uuid, text) from public;
revoke all on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) from public;
revoke all on function public.admin_commission_period_bounds(text, date, date) from public;
revoke all on function public.admin_get_reseller_commission_overview(text, date, date) from public;
revoke all on function public.admin_get_reseller_commission_detail(uuid, text, date, date) from public;

grant execute on function public.admin_transition_sale_status(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) to authenticated;
grant execute on function public.admin_get_reseller_commission_overview(text, date, date) to authenticated;
grant execute on function public.admin_get_reseller_commission_detail(uuid, text, date, date) to authenticated;

notify pgrst, 'reload schema';

commit;
