begin;

alter table public.product_admin_details
  add column if not exists inventory_hidden boolean not null default false;

create index if not exists product_admin_details_inventory_hidden_idx
  on public.product_admin_details (inventory_hidden);

create unique index if not exists product_admin_details_sku_unique_idx
  on public.product_admin_details (lower(sku))
  where sku is not null and btrim(sku) <> '';

create or replace function public.admin_bulk_update_inventory_products(p_items jsonb)
returns table (
  product_id uuid,
  sku text,
  supplier_id uuid,
  inventory_hidden boolean,
  stock_before integer,
  stock_after integer,
  movement_type text,
  movement_quantity integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item record;
  v_product record;
  v_sku text;
  v_target_stock integer;
  v_existing_product_name text;
  v_duplicate_count integer;
  v_supplier_exists boolean;
  v_location_id uuid;
  v_delta integer;
  v_movement_type text;
  v_movement_quantity integer;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can update inventory';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No inventory changes were provided';
  end if;

  select loc.id
  into v_location_id
  from public.inventory_locations as loc
  where loc.is_active = true
  order by loc.is_default desc, loc.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Active inventory location not found';
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(
      product_id uuid,
      sku text,
      supplier_id uuid,
      target_stock integer,
      inventory_hidden boolean
    )
  loop
    if v_item.product_id is null then
      raise exception 'Producto no encontrado.';
    end if;

    select count(*)
    into v_duplicate_count
    from jsonb_to_recordset(p_items) as other_item(product_id uuid)
    where other_item.product_id = v_item.product_id;

    if v_duplicate_count > 1 then
      raise exception 'El mismo producto aparece mas de una vez en los cambios.';
    end if;

    v_sku := nullif(btrim(coalesce(v_item.sku, '')), '');
    v_target_stock := coalesce(v_item.target_stock, 0);

    if v_target_stock < 0 then
      raise exception 'El stock fisico no puede ser negativo.';
    end if;

    select
      pr.id,
      pr.name,
      coalesce(pr.stock_quantity, 0) as stock_quantity,
      coalesce(pr.reserved_stock_quantity, 0) as reserved_stock_quantity,
      coalesce(pr.cost_price, 0) as cost_price,
      coalesce(pad.track_inventory, true) as track_inventory
    into v_product
    from public.products as pr
    left join public.product_admin_details as pad on pad.product_id = pr.id
    where pr.id = v_item.product_id
    for update of pr;

    if not found then
      raise exception 'Producto no encontrado.';
    end if;

    if v_product.track_inventory = false then
      raise exception 'El control de inventario esta desactivado para %.', v_product.name;
    end if;

    if v_target_stock < v_product.reserved_stock_quantity then
      raise exception 'No podes dejar el stock fisico en % porque existen % unidades reservadas para %.',
        v_target_stock,
        v_product.reserved_stock_quantity,
        v_product.name;
    end if;

    if v_item.supplier_id is not null then
      select exists (
        select 1
        from public.suppliers as supplier_row
        where supplier_row.id = v_item.supplier_id
          and supplier_row.is_active = true
      )
      into v_supplier_exists;

      if not v_supplier_exists then
        raise exception 'El proveedor seleccionado no existe o esta inactivo.';
      end if;
    end if;

    if v_sku is not null then
      select pr_existing.name
      into v_existing_product_name
      from public.product_admin_details as pad_existing
      join public.products as pr_existing on pr_existing.id = pad_existing.product_id
      where lower(pad_existing.sku) = lower(v_sku)
        and pad_existing.product_id <> v_item.product_id
      limit 1;

      if v_existing_product_name is not null then
        raise exception 'No se pudieron guardar los cambios. El codigo % ya pertenece a %.',
          v_sku,
          v_existing_product_name;
      end if;

      select count(*)
      into v_duplicate_count
      from jsonb_to_recordset(p_items) as other_item(product_id uuid, sku text)
      where other_item.product_id <> v_item.product_id
        and lower(nullif(btrim(coalesce(other_item.sku, '')), '')) = lower(v_sku);

      if v_duplicate_count > 0 then
        raise exception 'No se pudieron guardar los cambios. El codigo % esta repetido en la carga.', v_sku;
      end if;
    end if;
  end loop;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(
      product_id uuid,
      sku text,
      supplier_id uuid,
      target_stock integer,
      inventory_hidden boolean
    )
  loop
    v_sku := nullif(btrim(coalesce(v_item.sku, '')), '');
    v_target_stock := coalesce(v_item.target_stock, 0);

    select
      pr.id,
      pr.name,
      coalesce(pr.stock_quantity, 0) as stock_quantity,
      coalesce(pr.reserved_stock_quantity, 0) as reserved_stock_quantity,
      coalesce(pr.cost_price, 0) as cost_price
    into v_product
    from public.products as pr
    where pr.id = v_item.product_id
    for update;

    insert into public.product_admin_details as pad (
      product_id,
      sku,
      supplier_id,
      inventory_hidden,
      updated_at
    )
    values (
      v_item.product_id,
      v_sku,
      v_item.supplier_id,
      coalesce(v_item.inventory_hidden, false),
      now()
    )
    on conflict on constraint product_admin_details_pkey do update
    set sku = excluded.sku,
        supplier_id = excluded.supplier_id,
        inventory_hidden = excluded.inventory_hidden,
        updated_at = now();

    v_delta := v_target_stock - v_product.stock_quantity;
    v_movement_type := null;
    v_movement_quantity := 0;

    if v_delta <> 0 then
      v_movement_type := case when v_delta > 0 then 'adjustment_in' else 'adjustment_out' end;
      v_movement_quantity := abs(v_delta);

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
        v_item.product_id,
        v_location_id,
        v_movement_type,
        v_delta,
        v_product.stock_quantity,
        v_target_stock,
        v_product.cost_price,
        'Ajuste desde carga rapida de inventario',
        null,
        'inventory_bulk_edit',
        null,
        v_uid
      );

      update public.products as pr
      set stock_quantity = v_target_stock,
          updated_at = now()
      where pr.id = v_item.product_id;
    end if;

    return query
    select
      v_item.product_id,
      v_sku,
      v_item.supplier_id,
      coalesce(v_item.inventory_hidden, false),
      v_product.stock_quantity,
      v_target_stock,
      v_movement_type,
      v_movement_quantity;
  end loop;
end;
$$;

alter function public.admin_bulk_update_inventory_products(jsonb) owner to postgres;
revoke all on function public.admin_bulk_update_inventory_products(jsonb) from public;
grant execute on function public.admin_bulk_update_inventory_products(jsonb) to authenticated;

commit;
