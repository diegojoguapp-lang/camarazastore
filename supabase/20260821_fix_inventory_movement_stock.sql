begin;

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
  v_has_opening_balance boolean;
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

  select
    coalesce(pr.stock_quantity, 0),
    coalesce(pr.reserved_stock_quantity, 0),
    coalesce(pr.cost_price, 0)
  into
    v_stock_before,
    v_reserved,
    v_product_cost
  from public.products as pr
  where pr.id = p_product_id
  for update;

  if v_stock_before is null then
    raise exception 'Producto no encontrado.';
  end if;

  if p_movement_type = 'opening_balance' then
    select exists (
      select 1
      from public.inventory_movements as existing_im
      where existing_im.product_id = p_product_id
        and existing_im.movement_type = 'opening_balance'
    )
    into v_has_opening_balance;

    if v_has_opening_balance then
      raise exception 'Opening balance already exists for this product';
    end if;

    if v_stock_before <> 0 then
      raise exception 'Opening balance can only be used when current stock is zero';
    end if;
  end if;

  v_delta := case
    when p_movement_type in ('opening_balance', 'manual_entry', 'adjustment_in') then p_quantity
    else -p_quantity
  end;

  insert into public.product_admin_details as pad (product_id)
  values (p_product_id)
  on conflict on constraint product_admin_details_pkey do nothing;

  select pad.track_inventory
  into v_track_inventory
  from public.product_admin_details as pad
  where pad.product_id = p_product_id;

  if v_track_inventory = false then
    raise exception 'Inventory tracking is disabled for this product';
  end if;

  select loc.id
  into v_location_id
  from public.inventory_locations as loc
  where (p_location_id is null or loc.id = p_location_id)
    and loc.is_active = true
  order by loc.is_default desc, loc.created_at asc
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

  insert into public.inventory_movements as im (
    product_id,
    location_id,
    movement_type,
    quantity_delta,
    stock_before,
    stock_after,
    unit_cost_snapshot,
    reason,
    notes,
    source_type,
    source_id,
    created_by
  )
  values (
    p_product_id,
    v_location_id,
    p_movement_type,
    v_delta,
    v_stock_before,
    v_stock_after,
    coalesce(p_unit_cost_snapshot, v_product_cost),
    v_reason,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_clean_source_type,
    p_source_id,
    v_uid
  )
  returning im.id, im.created_at
  into v_movement_id, v_created_at;

  update public.products as pr
  set stock_quantity = v_stock_after,
      updated_at = now()
  where pr.id = p_product_id;

  return query
  select
    v_movement_id,
    p_product_id,
    v_location_id,
    p_movement_type,
    v_delta,
    v_stock_before,
    v_stock_after,
    v_created_at;
end;
$$;

alter function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) owner to postgres;
revoke all on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) from public;
grant execute on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) to authenticated;

commit;
