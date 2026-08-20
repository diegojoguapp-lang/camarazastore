-- Camaraza Store Re-venta - Fase A: nucleo de ventas multiproducto.
-- Ejecutar manualmente despues de Fase 6.1.
-- No conecta ventas con inventario, caja, compras ni finanzas.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if exists (
    select 1
    from public.customers
    where normalized_phone is not null
      and normalized_phone <> ''
    group by normalized_phone
    having count(*) > 1
  ) then
    raise exception 'No se puede continuar: existen clientes con telefonos duplicados. Corregir normalized_phone antes de ejecutar Fase A.';
  end if;
end;
$$;

create unique index if not exists customers_normalized_phone_unique_idx
  on public.customers(normalized_phone)
  where normalized_phone is not null and normalized_phone <> '';

alter table public.sales
  alter column reseller_id drop not null,
  add column if not exists sale_type text not null default 'reseller';

update public.sales
set sale_type = 'reseller'
where sale_type is null;

alter table public.sales drop constraint if exists sales_sale_type_check;
alter table public.sales
  add constraint sales_sale_type_check
  check (sale_type in ('direct', 'reseller'));

alter table public.sales drop constraint if exists sales_sale_type_reseller_check;
alter table public.sales
  add constraint sales_sale_type_reseller_check
  check (
    (sale_type = 'direct' and reseller_id is null)
    or
    (sale_type = 'reseller' and reseller_id is not null)
  );

alter table public.product_admin_details
  add column if not exists reseller_commission_amount numeric(14,2) not null default 0;

alter table public.product_admin_details drop constraint if exists product_admin_details_values_check;
alter table public.product_admin_details
  add constraint product_admin_details_values_check check (
    (retail_price is null or retail_price >= 0)
    and low_stock_threshold >= 0
    and reseller_commission_amount >= 0
  );

update public.product_admin_details d
set reseller_commission_amount = greatest(coalesce(p.suggested_price, 0) - coalesce(p.wholesale_price, 0), 0)
from public.products p
where p.id = d.product_id
  and coalesce(d.reseller_commission_amount, 0) = 0;

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  product_model_snapshot text,
  product_sku_snapshot text,
  quantity integer not null,
  unit_sale_price numeric(14,2) not null,
  unit_cost_snapshot numeric(14,2) not null,
  unit_commission_snapshot numeric(14,2) not null,
  line_subtotal numeric(14,2) not null,
  line_cost_total numeric(14,2) not null,
  line_commission_total numeric(14,2) not null,
  sort_order integer not null default 0,
  source_type text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint sale_items_quantity_check check (quantity > 0),
  constraint sale_items_amounts_check check (
    unit_sale_price >= 0
    and unit_cost_snapshot >= 0
    and unit_commission_snapshot >= 0
    and line_subtotal >= 0
    and line_cost_total >= 0
    and line_commission_total >= 0
  )
);

create index if not exists sale_items_sale_id_idx on public.sale_items(sale_id);
create index if not exists sale_items_product_id_idx on public.sale_items(product_id);
create unique index if not exists sale_items_legacy_sale_unique_idx
  on public.sale_items(sale_id)
  where source_type = 'legacy_sales';

create or replace function public.prepare_product_admin_details_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sku := nullif(regexp_replace(btrim(coalesce(new.sku, '')), '\s+', ' ', 'g'), '');
  new.track_inventory := coalesce(new.track_inventory, true);
  new.low_stock_threshold := coalesce(new.low_stock_threshold, 2);
  new.reseller_commission_amount := coalesce(new.reseller_commission_amount, 0);
  new.updated_at := now();

  if new.retail_price is not null and new.retail_price < 0 then
    raise exception 'Retail price cannot be negative';
  end if;

  if new.low_stock_threshold < 0 then
    raise exception 'Low stock threshold cannot be negative';
  end if;

  if new.reseller_commission_amount < 0 then
    raise exception 'Reseller commission amount cannot be negative';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_sale_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reseller_ok boolean := false;
  product_row record;
begin
  new.sale_type := coalesce(nullif(btrim(new.sale_type), ''), 'reseller');
  if new.sale_type not in ('direct', 'reseller') then
    raise exception 'Invalid sale_type';
  end if;

  if new.sale_type = 'direct' then
    new.reseller_id := null;
    new.reseller_commission := 0;
  else
    select exists (
      select 1
      from public.profiles p
      where p.id = new.reseller_id
        and p.role = 'reseller'
        and p.is_active = true
    )
    into reseller_ok;

    if not reseller_ok then
      raise exception 'Sale reseller_id must belong to an active reseller profile';
    end if;
  end if;

  if new.product_id is not null then
    select p.name, p.model, p.cost_price, p.suggested_price
    into product_row
    from public.products p
    where p.id = new.product_id;

    if product_row.name is null then
      raise exception 'Sale product_id must reference an existing product';
    end if;

    new.product_name_snapshot := coalesce(nullif(btrim(new.product_name_snapshot), ''), product_row.name);
    new.product_model_snapshot := coalesce(nullif(btrim(new.product_model_snapshot), ''), product_row.model);
    if coalesce(new.product_cost, 0) = 0 then
      new.product_cost := greatest(coalesce(product_row.cost_price, 0), 0);
    end if;
    if coalesce(new.product_sale_price, 0) = 0 then
      new.product_sale_price := greatest(coalesce(product_row.suggested_price, 0), 0);
    end if;
  end if;

  new.product_name_snapshot := nullif(btrim(new.product_name_snapshot), '');
  if new.product_name_snapshot is null then
    raise exception 'Sale product_name_snapshot is required';
  end if;

  new.quantity := greatest(coalesce(new.quantity, 1), 1);
  new.product_sale_price := greatest(coalesce(new.product_sale_price, 0), 0);
  new.product_cost := greatest(coalesce(new.product_cost, 0), 0);
  new.delivery_charged := greatest(coalesce(new.delivery_charged, 0), 0);
  new.delivery_cost := 0;
  new.reseller_commission := case when new.sale_type = 'direct' then 0 else greatest(coalesce(new.reseller_commission, 0), 0) end;
  new.other_costs := 0;
  new.amount_received := greatest(coalesce(new.amount_received, 0), 0);
  new.fulfillment_type := coalesce(nullif(btrim(new.fulfillment_type), ''), 'delivery');
  new.payment_method := nullif(btrim(new.payment_method), '');
  new.payment_timing := coalesce(nullif(btrim(new.payment_timing), ''), 'on_delivery');
  new.delivery_schedule := nullif(btrim(new.delivery_schedule), '');

  new.total_collected := new.product_sale_price + new.delivery_charged;
  new.camaraza_net_profit := new.product_sale_price - new.product_cost - new.reseller_commission;

  if new.status = 'delivered_paid' and new.amount_received = 0 then
    new.amount_received := new.total_collected;
  end if;

  new.updated_at := now();

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'confirmed' and new.confirmed_at is null then
      new.confirmed_at := now();
    elsif new.status = 'out_for_delivery' and new.dispatched_at is null then
      new.dispatched_at := now();
    elsif new.status = 'delivered_paid' then
      new.delivered_at := coalesce(new.delivered_at, now());
      new.paid_at := coalesce(new.paid_at, now());
    elsif new.status = 'cancelled' and new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;

  if tg_op = 'INSERT' and new.status = 'delivered_paid' then
    new.delivered_at := coalesce(new.delivered_at, now());
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_sale_from_items(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_item_count integer;
  v_quantity integer;
  v_subtotal numeric(14,2);
  v_cost_total numeric(14,2);
  v_commission_total numeric(14,2);
  v_first_item public.sale_items%rowtype;
begin
  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;

  select
    count(*),
    coalesce(sum(quantity), 0),
    coalesce(sum(line_subtotal), 0),
    coalesce(sum(line_cost_total), 0),
    coalesce(sum(line_commission_total), 0)
  into v_item_count, v_quantity, v_subtotal, v_cost_total, v_commission_total
  from public.sale_items
  where sale_id = p_sale_id;

  if v_item_count = 0 then
    raise exception 'A sale must have at least one item';
  end if;

  select *
  into v_first_item
  from public.sale_items
  where sale_id = p_sale_id
  order by sort_order asc, created_at asc, id asc
  limit 1;

  update public.sales
  set
    product_id = case when v_item_count = 1 then v_first_item.product_id else null end,
    product_name_snapshot = case when v_item_count = 1 then v_first_item.product_name_snapshot else v_item_count::text || ' productos' end,
    product_model_snapshot = case when v_item_count = 1 then v_first_item.product_model_snapshot else null end,
    quantity = greatest(v_quantity, 1),
    product_sale_price = v_subtotal,
    product_cost = v_cost_total,
    reseller_commission = case when sale_type = 'direct' then 0 else v_commission_total end,
    total_collected = v_subtotal + coalesce(delivery_charged, 0),
    camaraza_net_profit = v_subtotal - v_cost_total - case when sale_type = 'direct' then 0 else v_commission_total end,
    amount_received = case
      when status = 'delivered_paid' and coalesce(amount_received, 0) = 0 then v_subtotal + coalesce(delivery_charged, 0)
      when status <> 'delivered_paid' then 0
      else amount_received
    end,
    updated_at = now()
  where id = p_sale_id;
end;
$$;

create or replace function public.admin_save_sale(
  p_sale_id uuid default null,
  p_sale_type text default 'reseller',
  p_customer_id uuid default null,
  p_reseller_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_status text default 'pending_contact',
  p_delivery_charged numeric default 0,
  p_delivery_city text default null,
  p_delivery_reference text default null,
  p_delivery_schedule text default null,
  p_fulfillment_type text default 'delivery',
  p_payment_method text default 'cash',
  p_payment_timing text default 'on_delivery',
  p_admin_notes text default null,
  p_reseller_visible_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_sale_type text := coalesce(nullif(btrim(p_sale_type), ''), 'reseller');
  v_existing public.sales%rowtype;
  v_created_by uuid := auth.uid();
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_quantity integer;
  v_unit_sale_price numeric(14,2);
  v_unit_cost numeric(14,2);
  v_unit_commission numeric(14,2);
  v_sort integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can save sales';
  end if;

  if v_created_by is null then
    raise exception 'Authenticated admin session is required';
  end if;

  if v_sale_type not in ('direct', 'reseller') then
    raise exception 'Invalid sale_type';
  end if;

  if p_customer_id is null or not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'Customer is required';
  end if;

  if v_sale_type = 'direct' and p_reseller_id is not null then
    raise exception 'Direct sales cannot have reseller_id';
  end if;

  if v_sale_type = 'reseller' and not exists (
    select 1 from public.profiles p
    where p.id = p_reseller_id and p.role = 'reseller' and p.is_active = true
  ) then
    raise exception 'Reseller sale requires an active reseller';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one sale item is required';
  end if;

  if coalesce(p_delivery_charged, 0) < 0 then
    raise exception 'Delivery cannot be negative';
  end if;

  if p_sale_id is not null then
    select * into v_existing from public.sales where id = p_sale_id for update;
    if v_existing.id is null then
      raise exception 'Sale not found';
    end if;
    if v_existing.status = 'delivered_paid' or coalesce(v_existing.commission_paid, false) = true then
      raise exception 'Delivered or paid-commission sales cannot be commercially edited';
    end if;

    update public.sales
    set
      sale_type = v_sale_type,
      reseller_id = case when v_sale_type = 'direct' then null else p_reseller_id end,
      customer_id = p_customer_id,
      status = coalesce(nullif(btrim(p_status), ''), v_existing.status),
      delivery_charged = coalesce(p_delivery_charged, 0),
      delivery_city = nullif(btrim(p_delivery_city), ''),
      delivery_reference = nullif(btrim(p_delivery_reference), ''),
      delivery_schedule = nullif(btrim(p_delivery_schedule), ''),
      fulfillment_type = coalesce(nullif(btrim(p_fulfillment_type), ''), 'delivery'),
      payment_method = coalesce(nullif(btrim(p_payment_method), ''), 'cash'),
      payment_timing = coalesce(nullif(btrim(p_payment_timing), ''), 'on_delivery'),
      admin_notes = nullif(btrim(p_admin_notes), ''),
      reseller_visible_notes = nullif(btrim(p_reseller_visible_notes), '')
    where id = p_sale_id
    returning id into v_sale_id;

    delete from public.sale_items where sale_id = v_sale_id and source_type <> 'legacy_sales';
    delete from public.sale_items where sale_id = v_sale_id and source_type = 'legacy_sales';
  else
    insert into public.sales (
      sale_type,
      reseller_id,
      customer_id,
      product_name_snapshot,
      quantity,
      status,
      created_by,
      delivery_charged,
      delivery_city,
      delivery_reference,
      delivery_schedule,
      fulfillment_type,
      payment_method,
      payment_timing,
      admin_notes,
      reseller_visible_notes
    )
    values (
      v_sale_type,
      case when v_sale_type = 'direct' then null else p_reseller_id end,
      p_customer_id,
      'Venta',
      1,
      coalesce(nullif(btrim(p_status), ''), 'pending_contact'),
      v_created_by,
      coalesce(p_delivery_charged, 0),
      nullif(btrim(p_delivery_city), ''),
      nullif(btrim(p_delivery_reference), ''),
      nullif(btrim(p_delivery_schedule), ''),
      coalesce(nullif(btrim(p_fulfillment_type), ''), 'delivery'),
      coalesce(nullif(btrim(p_payment_method), ''), 'cash'),
      coalesce(nullif(btrim(p_payment_timing), ''), 'on_delivery'),
      nullif(btrim(p_admin_notes), ''),
      nullif(btrim(p_reseller_visible_notes), '')
    )
    returning id into v_sale_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_sort := v_sort + 1;
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_sale_price := (v_item->>'unit_sale_price')::numeric;

    if v_product_id is null then
      raise exception 'Item product_id is required';
    end if;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Item quantity must be greater than zero';
    end if;

    if v_unit_sale_price is null or v_unit_sale_price < 0 then
      raise exception 'Item unit_sale_price cannot be negative';
    end if;

    select
      p.id,
      p.name,
      p.model,
      coalesce(p.cost_price, 0) as cost_price,
      coalesce(d.sku, null) as sku,
      coalesce(d.reseller_commission_amount, 0) as reseller_commission_amount
    into v_product
    from public.products p
    left join public.product_admin_details d on d.product_id = p.id
    where p.id = v_product_id;

    if v_product.id is null then
      raise exception 'Sale item product does not exist';
    end if;

    v_unit_cost := greatest(coalesce(v_product.cost_price, 0), 0);
    v_unit_commission := case when v_sale_type = 'direct' then 0 else greatest(coalesce(v_product.reseller_commission_amount, 0), 0) end;

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name_snapshot,
      product_model_snapshot,
      product_sku_snapshot,
      quantity,
      unit_sale_price,
      unit_cost_snapshot,
      unit_commission_snapshot,
      line_subtotal,
      line_cost_total,
      line_commission_total,
      sort_order,
      source_type
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_product.model,
      v_product.sku,
      v_quantity,
      v_unit_sale_price,
      v_unit_cost,
      v_unit_commission,
      v_unit_sale_price * v_quantity,
      v_unit_cost * v_quantity,
      v_unit_commission * v_quantity,
      coalesce((v_item->>'sort_order')::integer, v_sort),
      'manual'
    );
  end loop;

  perform public.recalculate_sale_from_items(v_sale_id);

  return v_sale_id;
end;
$$;

create or replace function public.get_my_sale_items(p_sale_id uuid)
returns table (
  sale_id uuid,
  product_name text,
  product_model text,
  quantity integer,
  unit_sale_price numeric,
  line_subtotal numeric,
  line_commission_total numeric,
  sort_order integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authenticated reseller session is required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'reseller' and p.is_active = true
  ) then
    raise exception 'Active reseller profile is required';
  end if;

  return query
  select
    i.sale_id,
    i.product_name_snapshot,
    i.product_model_snapshot,
    i.quantity,
    i.unit_sale_price,
    i.line_subtotal,
    i.line_commission_total,
    i.sort_order
  from public.sale_items i
  join public.sales s on s.id = i.sale_id
  where i.sale_id = p_sale_id
    and s.reseller_id = v_uid
    and s.sale_type = 'reseller'
  order by i.sort_order asc, i.created_at asc, i.id asc;
end;
$$;

drop function if exists public.get_my_sales(
  text,
  text,
  integer,
  integer,
  date,
  date
);

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
  commission_paid_at timestamptz,
  items jsonb
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
      else left(public.normalize_customer_phone(c.phone), 3) || '*****' || right(public.normalize_customer_phone(c.phone), 2)
    end as customer_phone_masked,
    c.city as customer_city,
    coalesce(s.commission_paid, false) as commission_paid,
    s.commission_paid_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name_snapshot,
        'product_model', i.product_model_snapshot,
        'quantity', i.quantity,
        'unit_sale_price', i.unit_sale_price,
        'line_subtotal', i.line_subtotal,
        'line_commission_total', i.line_commission_total,
        'sort_order', i.sort_order
      ) order by i.sort_order asc, i.created_at asc, i.id asc)
      from public.sale_items i
      where i.sale_id = s.id
    ), '[]'::jsonb) as items
  from public.sales s
  join public.customers c on c.id = s.customer_id
  where s.reseller_id = v_uid
    and s.sale_type = 'reseller'
    and (p_status is null or s.status = p_status)
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or s.product_name_snapshot ilike '%' || btrim(p_search) || '%'
      or exists (
        select 1 from public.sale_items i
        where i.sale_id = s.id
          and i.product_name_snapshot ilike '%' || btrim(p_search) || '%'
      )
    )
    and (p_date_from is null or (s.delivered_at at time zone 'America/Asuncion')::date >= p_date_from)
    and (p_date_to is null or (s.delivered_at at time zone 'America/Asuncion')::date <= p_date_to)
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
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'reseller' and p.is_active = true
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
      and s.sale_type = 'reseller'
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
      coalesce(sum(os.reseller_commission) filter (where os.status in ('confirmed', 'preparing', 'out_for_delivery')), 0) as estimated_commission,
      coalesce(sum(os.reseller_commission) filter (where os.status = 'delivered_paid' and os.commission_paid = false), 0) as unpaid_confirmed_commission,
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
      coalesce(sum(os.reseller_commission) filter (where os.status = 'delivered_paid'), 0) as total_historical_commission,
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
    pt.paid_total,
    pt.pending_total,
    v_period_start + 7,
    v_period_start,
    v_period_end,
    st.pending_contact_sales,
    st.confirmed_sales,
    st.preparing_sales,
    st.out_for_delivery_sales,
    st.cancelled_or_failed_sales
  from sales_totals st
  cross join payment_totals pt;
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
    and sale_type = 'reseller'
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
    and sale_type = 'reseller'
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
      ('first_payment', v_paid_count),
      ('commission_500k', floor(v_historical_commission / 500000)::integer),
      ('weekly_goal', case when v_weekly_sales >= coalesce(v_weekly_goal, 10) then 1 else 0 end)
  ) as earned(key, progress)
  where progress > 0
  on conflict (reseller_id, achievement_key)
  do update set progress = greatest(public.reseller_achievements.progress, excluded.progress);
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
      and s.sale_type = 'reseller'
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
    select i.product_name_snapshot, sum(i.quantity) as qty
    from delivered d
    join public.sale_items i on i.sale_id = d.id
    group by i.product_name_snapshot
    order by qty desc, i.product_name_snapshot asc
    limit 1
  ),
  current_week as (
    select (now() at time zone 'America/Asuncion')::date - ((extract(isodow from (now() at time zone 'America/Asuncion')::date)::integer + 6) % 7) as week_start
  ),
  streak_weeks as (
    select gs.n, cw.week_start - (gs.n * 7) as week_start, cw.week_start - (gs.n * 7) + 6 as week_end_exclusive
    from current_week cw
    cross join generate_series(0, 52) as gs(n)
  ),
  streak_hits as (
    select
      sw.n,
      exists (
        select 1 from delivered d
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
    'sales_last_7_days', (select count(*) from delivered where delivered_at >= (((now() at time zone 'America/Asuncion') - interval '7 days') at time zone 'America/Asuncion')),
    'sales_last_30_days', (select count(*) from delivered where delivered_at >= (((now() at time zone 'America/Asuncion') - interval '30 days') at time zone 'America/Asuncion')),
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

drop view if exists public.reseller_sales;
create view public.reseller_sales
with (security_barrier = true, security_invoker = true)
as
select
  s.id,
  s.reseller_id,
  s.product_id,
  s.product_name_snapshot,
  s.product_model_snapshot,
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
    when length(public.normalize_customer_phone(c.phone)) <= 4 then '****'
    else substring(public.normalize_customer_phone(c.phone) from 1 for 2) || '** *** *' || right(public.normalize_customer_phone(c.phone), 2)
  end as customer_phone_masked,
  c.city as customer_city,
  s.commission_paid
from public.sales s
join public.customers c on c.id = s.customer_id
where s.reseller_id = auth.uid()
  and s.sale_type = 'reseller';

revoke all on public.reseller_sales from public;
grant select on public.reseller_sales to authenticated;

insert into public.sale_items (
  sale_id,
  product_id,
  product_name_snapshot,
  product_model_snapshot,
  quantity,
  unit_sale_price,
  unit_cost_snapshot,
  unit_commission_snapshot,
  line_subtotal,
  line_cost_total,
  line_commission_total,
  source_type
)
select
  s.id,
  s.product_id,
  s.product_name_snapshot,
  s.product_model_snapshot,
  greatest(coalesce(s.quantity, 1), 1),
  coalesce(s.product_sale_price, 0),
  coalesce(s.product_cost, 0),
  coalesce(s.reseller_commission, 0),
  coalesce(s.product_sale_price, 0),
  coalesce(s.product_cost, 0),
  coalesce(s.reseller_commission, 0),
  'legacy_sales'
from public.sales s
where not exists (
  select 1
  from public.sale_items i
  where i.sale_id = s.id
    and i.source_type = 'legacy_sales'
);

alter table public.sale_items enable row level security;

drop policy if exists "Admins can read sale items" on public.sale_items;
create policy "Admins can read sale items"
on public.sale_items for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert sale items" on public.sale_items;
create policy "Admins can insert sale items"
on public.sale_items for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update sale items" on public.sale_items;
create policy "Admins can update sale items"
on public.sale_items for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Resellers can read own sale items" on public.sale_items;
drop policy if exists "Public can read sale items" on public.sale_items;

alter function public.recalculate_sale_from_items(uuid) owner to postgres;
alter function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text) owner to postgres;
alter function public.get_my_sale_items(uuid) owner to postgres;
alter function public.get_my_sales(text, text, integer, integer, date, date) owner to postgres;
alter function public.get_my_reseller_dashboard() owner to postgres;
alter function public.sync_my_achievements() owner to postgres;
alter function public.get_my_performance() owner to postgres;

revoke all on function public.recalculate_sale_from_items(uuid) from public;
revoke all on function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text) from public;
revoke all on function public.get_my_sale_items(uuid) from public;
revoke all on function public.get_my_sales(text, text, integer, integer, date, date) from public;
revoke all on function public.get_my_reseller_dashboard() from public;
revoke all on function public.sync_my_achievements() from public;
revoke all on function public.get_my_performance() from public;

grant execute on function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_my_sale_items(uuid) to authenticated;
grant execute on function public.get_my_sales(text, text, integer, integer, date, date) to authenticated;
grant execute on function public.get_my_reseller_dashboard() to authenticated;
grant execute on function public.get_my_performance() to authenticated;

notify pgrst, 'reload schema';

commit;
