begin;

alter table public.sales
  alter column customer_id drop not null,
  add column if not exists customer_name_snapshot text,
  add column if not exists customer_phone_snapshot text,
  add column if not exists customer_document text,
  add column if not exists shipping_carrier_name text;

alter table public.sales drop constraint if exists sales_fulfillment_type_check;
alter table public.sales
  add constraint sales_fulfillment_type_check
  check (coalesce(fulfillment_type, 'delivery') in ('delivery', 'shipping', 'pickup', 'transportadora'));

drop function if exists public.admin_save_sale(
  uuid,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

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
  p_reseller_visible_notes text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_document text default null,
  p_shipping_carrier_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_sale_type text := coalesce(nullif(btrim(p_sale_type), ''), 'reseller');
  v_status text := coalesce(nullif(btrim(p_status), ''), 'confirmed');
  v_fulfillment_type text := coalesce(nullif(btrim(p_fulfillment_type), ''), 'delivery');
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

  if v_status not in ('pending_contact','confirmed','preparing','out_for_delivery') then
    raise exception 'Sales can be commercially saved only before delivery';
  end if;

  if v_fulfillment_type = 'transportadora' then
    v_fulfillment_type := 'shipping';
  end if;
  if v_fulfillment_type not in ('delivery', 'shipping', 'pickup') then
    raise exception 'Invalid fulfillment_type';
  end if;

  if p_customer_id is not null and not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'Customer does not exist';
  end if;

  if p_customer_id is null and nullif(btrim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Customer name is required';
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
    if v_existing.status in ('delivered_paid', 'returned') or coalesce(v_existing.commission_paid, false) = true then
      raise exception 'Delivered, returned or paid-commission sales cannot be commercially edited';
    end if;
    if v_existing.status in ('confirmed', 'preparing', 'out_for_delivery') then
      perform public.admin_release_sale_stock(p_sale_id);
    end if;

    update public.sales
    set
      sale_type = v_sale_type,
      reseller_id = case when v_sale_type = 'direct' then null else p_reseller_id end,
      customer_id = p_customer_id,
      customer_name_snapshot = nullif(btrim(p_customer_name), ''),
      customer_phone_snapshot = nullif(btrim(p_customer_phone), ''),
      customer_document = nullif(btrim(p_customer_document), ''),
      shipping_carrier_name = nullif(btrim(p_shipping_carrier_name), ''),
      status = v_status,
      delivery_charged = coalesce(p_delivery_charged, 0),
      delivery_city = nullif(btrim(p_delivery_city), ''),
      delivery_reference = nullif(btrim(p_delivery_reference), ''),
      delivery_schedule = nullif(btrim(p_delivery_schedule), ''),
      fulfillment_type = v_fulfillment_type,
      payment_method = coalesce(nullif(btrim(p_payment_method), ''), 'cash'),
      payment_timing = coalesce(nullif(btrim(p_payment_timing), ''), 'on_delivery'),
      admin_notes = nullif(btrim(p_admin_notes), ''),
      reseller_visible_notes = nullif(btrim(p_reseller_visible_notes), ''),
      updated_at = now()
    where id = p_sale_id
    returning id into v_sale_id;

    delete from public.sale_items where sale_id = v_sale_id;
  else
    insert into public.sales (
      sale_type,
      reseller_id,
      customer_id,
      customer_name_snapshot,
      customer_phone_snapshot,
      customer_document,
      shipping_carrier_name,
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
      nullif(btrim(p_customer_name), ''),
      nullif(btrim(p_customer_phone), ''),
      nullif(btrim(p_customer_document), ''),
      nullif(btrim(p_shipping_carrier_name), ''),
      'Venta',
      1,
      v_status,
      v_created_by,
      coalesce(p_delivery_charged, 0),
      nullif(btrim(p_delivery_city), ''),
      nullif(btrim(p_delivery_reference), ''),
      nullif(btrim(p_delivery_schedule), ''),
      v_fulfillment_type,
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
      coalesce(p.wholesale_price, 0) as wholesale_price,
      d.sku
    into v_product
    from public.products p
    left join public.product_admin_details d on d.product_id = p.id
    where p.id = v_product_id;

    if v_product.id is null then
      raise exception 'Sale item product does not exist';
    end if;

    v_unit_cost := greatest(coalesce(v_product.cost_price, 0), 0);
    if v_sale_type = 'direct' then
      v_unit_commission := 0;
    else
      if v_unit_sale_price < greatest(coalesce(v_product.wholesale_price, 0), 0) then
        raise exception 'El precio de venta no puede ser menor al precio mayorista de % Gs.', v_product.wholesale_price;
      end if;
      v_unit_commission := v_unit_sale_price - greatest(coalesce(v_product.wholesale_price, 0), 0);
    end if;

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

  if v_status in ('confirmed', 'preparing', 'out_for_delivery') then
    perform public.admin_reserve_sale_stock(v_sale_id);
  end if;

  return v_sale_id;
end;
$$;

alter function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text, text, text, text, text) owner to postgres;
revoke all on function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

drop function if exists public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid);

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
  v_movement_id uuid;
  v_created_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can manage inventory';
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
  where l.id = coalesce(p_location_id, l.id)
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
    coalesce(nullif(btrim(p_source_type), ''), 'manual'), p_source_id, v_uid
  )
  returning id, inventory_movements.created_at into v_movement_id, v_created_at;

  update public.products
  set stock_quantity = v_stock_after,
      updated_at = now()
  where id = p_product_id;

  return query select v_movement_id, p_product_id, v_location_id, p_movement_type, v_delta, v_stock_before, v_stock_after, v_created_at;
end;
$$;

alter function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) owner to postgres;
revoke all on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) from public;
grant execute on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) to authenticated;

grant execute on function public.get_reseller_catalog() to anon, authenticated;
grant execute on function public.get_reseller_product(text) to anon, authenticated;

commit;
