-- Camaraza Store Re-venta - MacroFase 1: inventario reservado y comisiones 2.0.
-- Ejecutar manualmente despues de Fase A y Fase 6.1.
-- No crea caja, compras, finanzas generales ni modifica historiales pagados.

begin;

create extension if not exists pgcrypto;

alter table public.products
  add column if not exists reserved_stock_quantity integer not null default 0;

alter table public.products
  add column if not exists available_stock_quantity integer
  generated always as (coalesce(stock_quantity, 0) - coalesce(reserved_stock_quantity, 0)) stored;

alter table public.products drop constraint if exists products_reserved_stock_quantity_check;
alter table public.products
  add constraint products_reserved_stock_quantity_check
  check (reserved_stock_quantity >= 0);

alter table public.products drop constraint if exists products_available_stock_quantity_check;
alter table public.products
  add constraint products_available_stock_quantity_check
  check (coalesce(stock_quantity, 0) >= reserved_stock_quantity);

create table if not exists public.sale_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  sale_item_id uuid references public.sale_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  location_id uuid references public.inventory_locations(id) on delete restrict,
  quantity integer not null,
  status text not null default 'active',
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_stock_reservations_quantity_check check (quantity > 0),
  constraint sale_stock_reservations_status_check check (status in ('active', 'released', 'consumed')),
  constraint sale_stock_reservations_dates_check check (
    (status = 'active' and released_at is null and consumed_at is null)
    or (status = 'released' and released_at is not null)
    or (status = 'consumed' and consumed_at is not null)
  )
);

create index if not exists sale_stock_reservations_sale_id_idx on public.sale_stock_reservations(sale_id);
create index if not exists sale_stock_reservations_product_id_idx on public.sale_stock_reservations(product_id);
create index if not exists sale_stock_reservations_status_idx on public.sale_stock_reservations(status);
drop index if exists public.sale_stock_reservations_active_item_unique_idx;
create unique index sale_stock_reservations_active_item_unique_idx
on public.sale_stock_reservations(sale_item_id)
where sale_item_id is not null and status = 'active';

alter table public.inventory_movements drop constraint if exists inventory_movements_type_check;
alter table public.inventory_movements
  add constraint inventory_movements_type_check check (
    movement_type in (
      'opening_balance',
      'manual_entry',
      'manual_exit',
      'adjustment_in',
      'adjustment_out',
      'damaged',
      'lost',
      'sale_delivery',
      'sale_return'
    )
  );

alter table public.inventory_movements drop constraint if exists inventory_movements_direction_check;
alter table public.inventory_movements
  add constraint inventory_movements_direction_check check (
    (
      movement_type in ('opening_balance', 'manual_entry', 'adjustment_in', 'sale_return')
      and quantity_delta > 0
    )
    or (
      movement_type in ('manual_exit', 'adjustment_out', 'damaged', 'lost', 'sale_delivery')
      and quantity_delta < 0
    )
  );

drop index if exists public.inventory_movements_sale_item_type_unique_idx;
create unique index inventory_movements_sale_item_type_unique_idx
on public.inventory_movements(source_type, source_id, movement_type)
where source_type = 'sale_item'
  and source_id is not null
  and movement_type in ('sale_delivery', 'sale_return');

create table if not exists public.commission_adjustments (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete restrict,
  sale_id uuid references public.sales(id) on delete restrict,
  source_type text not null,
  amount numeric(14,2) not null,
  remaining_amount numeric(14,2) not null,
  status text not null default 'pending',
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_adjustments_amount_check check (amount <> 0 and remaining_amount <= 0),
  constraint commission_adjustments_status_check check (status in ('pending', 'applied', 'cancelled')),
  constraint commission_adjustments_source_check check (source_type in ('sale_return', 'manual'))
);

create table if not exists public.commission_payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.commission_payments(id) on delete restrict,
  adjustment_id uuid not null references public.commission_adjustments(id) on delete restrict,
  amount_applied numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint commission_payment_adjustments_amount_check check (amount_applied <= 0)
);

drop index if exists public.commission_adjustments_sale_return_unique_idx;
create unique index commission_adjustments_sale_return_unique_idx
on public.commission_adjustments(sale_id, source_type)
where sale_id is not null and source_type = 'sale_return' and status <> 'cancelled';

create index if not exists commission_adjustments_reseller_id_idx on public.commission_adjustments(reseller_id);
create index if not exists commission_adjustments_status_idx on public.commission_adjustments(status);
create index if not exists commission_payment_adjustments_payment_id_idx on public.commission_payment_adjustments(payment_id);
create index if not exists commission_payment_adjustments_adjustment_id_idx on public.commission_payment_adjustments(adjustment_id);

alter table public.sale_stock_reservations enable row level security;
alter table public.commission_adjustments enable row level security;
alter table public.commission_payment_adjustments enable row level security;

create or replace function public.admin_default_inventory_location()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_id uuid;
begin
  select l.id
  into v_location_id
  from public.inventory_locations l
  where l.is_active = true
  order by l.is_default desc, l.created_at asc
  limit 1;

  if v_location_id is null then
    raise exception 'Active inventory location not found';
  end if;

  return v_location_id;
end;
$$;

create or replace function public.recalculate_product_reserved_stock(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products p
  set reserved_stock_quantity = coalesce((
        select sum(r.quantity)
        from public.sale_stock_reservations r
        where r.product_id = p_product_id
          and r.status = 'active'
      ), 0),
      updated_at = now()
  where p.id = p_product_id;
end;
$$;

create or replace function public.prepare_sale_stock_reservation_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.admin_release_sale_stock(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can release reserved stock';
  end if;

  update public.sale_stock_reservations r
  set status = 'released',
      released_at = now(),
      updated_at = now()
  where r.sale_id = p_sale_id
    and r.status = 'active';

  for v_product_id in
    select distinct r.product_id
    from public.sale_stock_reservations r
    where r.sale_id = p_sale_id
  loop
    perform public.recalculate_product_reserved_stock(v_product_id);
  end loop;
end;
$$;

create or replace function public.admin_reserve_sale_stock(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_location_id uuid;
  v_need record;
  v_item record;
  v_available integer;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can reserve stock';
  end if;

  select *
  into v_sale
  from public.sales s
  where s.id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;

  if v_sale.status not in ('pending_contact', 'confirmed', 'preparing', 'out_for_delivery') then
    raise exception 'Stock can be reserved only for open sales';
  end if;

  perform public.admin_release_sale_stock(p_sale_id);
  v_location_id := public.admin_default_inventory_location();

  for v_need in
    select
      i.product_id,
      sum(i.quantity)::integer as quantity
    from public.sale_items i
    join public.product_admin_details d on d.product_id = i.product_id
    where i.sale_id = p_sale_id
      and coalesce(d.track_inventory, true) = true
    group by i.product_id
  loop
    select coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)
    into v_available
    from public.products p
    where p.id = v_need.product_id
    for update;

    if v_available is null then
      raise exception 'Sale item product does not exist';
    end if;

    if v_available < v_need.quantity then
      raise exception 'Stock insuficiente para reservar la venta. Producto %, disponible %, requerido %',
        v_need.product_id, v_available, v_need.quantity;
    end if;
  end loop;

  for v_item in
    select i.id, i.product_id, i.quantity
    from public.sale_items i
    join public.product_admin_details d on d.product_id = i.product_id
    where i.sale_id = p_sale_id
      and coalesce(d.track_inventory, true) = true
    order by i.sort_order asc, i.id asc
  loop
    insert into public.sale_stock_reservations (
      sale_id,
      sale_item_id,
      product_id,
      location_id,
      quantity,
      status
    )
    values (
      p_sale_id,
      v_item.id,
      v_item.product_id,
      v_location_id,
      v_item.quantity,
      'active'
    );
  end loop;

  for v_need in
    select distinct i.product_id
    from public.sale_items i
    join public.product_admin_details d on d.product_id = i.product_id
    where i.sale_id = p_sale_id
      and coalesce(d.track_inventory, true) = true
  loop
    perform public.recalculate_product_reserved_stock(v_need.product_id);
  end loop;
end;
$$;

create or replace function public.admin_consume_sale_stock(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_location_id uuid;
  v_reservation_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can consume stock';
  end if;

  v_location_id := public.admin_default_inventory_location();

  for v_item in
    select i.id, i.product_id, i.quantity, i.unit_cost_snapshot
    from public.sale_items i
    join public.product_admin_details d on d.product_id = i.product_id
    where i.sale_id = p_sale_id
      and coalesce(d.track_inventory, true) = true
    order by i.sort_order asc, i.id asc
  loop
    select r.id
    into v_reservation_id
    from public.sale_stock_reservations r
    where r.sale_item_id = v_item.id
      and r.status = 'active'
      and r.quantity = v_item.quantity
    for update;

    if v_reservation_id is null then
      raise exception 'La venta debe tener stock reservado antes de entregarse.';
    end if;

    select *
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    if coalesce(v_product.stock_quantity, 0) < v_item.quantity then
      raise exception 'Stock fisico insuficiente para entregar la venta.';
    end if;

    insert into public.inventory_movements (
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
      'sale_delivery',
      -v_item.quantity,
      coalesce(v_product.stock_quantity, 0),
      coalesce(v_product.stock_quantity, 0) - v_item.quantity,
      v_item.unit_cost_snapshot,
      'Entrega de venta',
      'Movimiento automatico al marcar venta como entregada y cobrada',
      'sale_item',
      v_item.id,
      auth.uid()
    )
    on conflict (source_type, source_id, movement_type)
    where source_type = 'sale_item'
      and source_id is not null
      and movement_type in ('sale_delivery', 'sale_return')
    do nothing;

    update public.products
    set stock_quantity = coalesce(stock_quantity, 0) - v_item.quantity,
        updated_at = now()
    where id = v_item.product_id;

    update public.sale_stock_reservations
    set status = 'consumed',
        consumed_at = now(),
        updated_at = now()
    where id = v_reservation_id;

    perform public.recalculate_product_reserved_stock(v_item.product_id);
  end loop;
end;
$$;

create or replace function public.admin_remove_sale_from_pending_commission_payment(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_batch_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can update commission payments';
  end if;

  select p.id, p.batch_id
  into v_payment_id, v_batch_id
  from public.commission_payment_items i
  join public.commission_payments p on p.id = i.payment_id
  where i.sale_id = p_sale_id
    and p.status = 'pending'
  for update of p;

  if v_payment_id is null then
    return;
  end if;

  delete from public.commission_payment_items i
  where i.sale_id = p_sale_id
    and i.payment_id = v_payment_id;

  update public.commission_payments p
  set gross_commission = coalesce((
        select sum(i.commission_amount_snapshot)
        from public.commission_payment_items i
        where i.payment_id = v_payment_id
      ), 0),
      updated_at = now()
  where p.id = v_payment_id;

  if not exists (
    select 1 from public.commission_payment_items i where i.payment_id = v_payment_id
  ) then
    update public.commission_payments p
    set status = 'cancelled',
        notes = coalesce(p.notes, 'Cancelado automaticamente: venta devuelta antes del pago.'),
        updated_at = now()
    where p.id = v_payment_id;
  end if;

  perform public.recalculate_commission_batch_status(v_batch_id);
end;
$$;

create or replace function public.admin_create_return_commission_adjustment(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_amount numeric(14,2);
begin
  if not public.is_admin() then
    raise exception 'Only active admins can create commission adjustments';
  end if;

  select *
  into v_sale
  from public.sales s
  where s.id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;

  if v_sale.sale_type <> 'reseller' or v_sale.reseller_id is null then
    return;
  end if;

  if coalesce(v_sale.commission_paid, false) = false then
    perform public.admin_remove_sale_from_pending_commission_payment(p_sale_id);
    return;
  end if;

  v_amount := -greatest(coalesce(v_sale.reseller_commission, 0), 0);
  if v_amount = 0 then
    return;
  end if;

  insert into public.commission_adjustments (
    reseller_id,
    sale_id,
    source_type,
    amount,
    remaining_amount,
    reason,
    created_by
  )
  values (
    v_sale.reseller_id,
    p_sale_id,
    'sale_return',
    v_amount,
    v_amount,
    'Descuento automatico por devolucion de venta ya pagada',
    auth.uid()
  )
  on conflict (sale_id, source_type)
  where sale_id is not null and source_type = 'sale_return' and status <> 'cancelled'
  do nothing;
end;
$$;

create or replace function public.admin_return_sale_stock(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_location_id uuid;
  v_delivery_count integer := 0;
  v_return_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can return stock';
  end if;

  v_location_id := public.admin_default_inventory_location();

  select count(*)
  into v_delivery_count
  from public.inventory_movements m
  join public.sale_items i on i.id = m.source_id
  where i.sale_id = p_sale_id
    and m.source_type = 'sale_item'
    and m.movement_type = 'sale_delivery';

  select count(*)
  into v_return_count
  from public.inventory_movements m
  join public.sale_items i on i.id = m.source_id
  where i.sale_id = p_sale_id
    and m.source_type = 'sale_item'
    and m.movement_type = 'sale_return';

  if v_delivery_count = 0 and exists (
    select 1
    from public.sale_items i
    join public.product_admin_details d on d.product_id = i.product_id
    where i.sale_id = p_sale_id
      and coalesce(d.track_inventory, true) = true
  ) then
    raise exception 'La venta no tiene movimiento automatico de entrega. Revisar historico antes de devolver.';
  end if;

  if v_return_count >= v_delivery_count and v_delivery_count > 0 then
    perform public.admin_create_return_commission_adjustment(p_sale_id);
    return;
  end if;

  for v_item in
    select i.id, i.product_id, i.quantity, i.unit_cost_snapshot
    from public.sale_items i
    join public.product_admin_details d on d.product_id = i.product_id
    where i.sale_id = p_sale_id
      and coalesce(d.track_inventory, true) = true
      and exists (
        select 1 from public.inventory_movements dm
        where dm.source_type = 'sale_item'
          and dm.source_id = i.id
          and dm.movement_type = 'sale_delivery'
      )
      and not exists (
        select 1 from public.inventory_movements rm
        where rm.source_type = 'sale_item'
          and rm.source_id = i.id
          and rm.movement_type = 'sale_return'
      )
    order by i.sort_order asc, i.id asc
  loop
    select *
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    insert into public.inventory_movements (
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
      'sale_return',
      v_item.quantity,
      coalesce(v_product.stock_quantity, 0),
      coalesce(v_product.stock_quantity, 0) + v_item.quantity,
      v_item.unit_cost_snapshot,
      'Devolucion de venta',
      'Movimiento automatico al marcar venta como devuelta',
      'sale_item',
      v_item.id,
      auth.uid()
    )
    on conflict (source_type, source_id, movement_type)
    where source_type = 'sale_item'
      and source_id is not null
      and movement_type in ('sale_delivery', 'sale_return')
    do nothing;

    update public.products
    set stock_quantity = coalesce(stock_quantity, 0) + v_item.quantity,
        updated_at = now()
    where id = v_item.product_id;
  end loop;

  perform public.admin_create_return_commission_adjustment(p_sale_id);
end;
$$;

create or replace function public.admin_transition_sale_status(
  p_sale_id uuid,
  p_status text,
  p_notes text default null
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
  v_reserved_states text[] := array['confirmed', 'preparing', 'out_for_delivery'];
begin
  if not public.is_admin() then
    raise exception 'Only active admins can update sales';
  end if;

  if v_new_status not in (
    'pending_contact',
    'confirmed',
    'preparing',
    'out_for_delivery',
    'delivered_paid',
    'cancelled',
    'failed_delivery',
    'returned'
  ) then
    raise exception 'Invalid sale status';
  end if;

  select *
  into v_sale
  from public.sales s
  where s.id = p_sale_id
  for update;

  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;

  if v_sale.status = 'returned' and v_new_status <> 'returned' then
    raise exception 'Returned sales cannot be reopened';
  end if;

  if v_sale.status = 'delivered_paid' and v_new_status <> 'returned' and v_new_status <> 'delivered_paid' then
    raise exception 'Delivered sales can only move to returned';
  end if;

  if v_new_status = v_sale.status then
    return query select v_sale.id, v_sale.status, v_sale.delivered_at, v_sale.paid_at;
    return;
  end if;

  if v_new_status = any(v_reserved_states) then
    perform public.admin_reserve_sale_stock(p_sale_id);
  elsif v_new_status in ('pending_contact', 'cancelled', 'failed_delivery') then
    perform public.admin_release_sale_stock(p_sale_id);
  elsif v_new_status = 'delivered_paid' then
    if v_sale.status <> all(v_reserved_states) then
      raise exception 'La venta debe estar confirmada, preparada o en reparto antes de entregarse.';
    end if;
    perform public.admin_consume_sale_stock(p_sale_id);
  elsif v_new_status = 'returned' then
    if v_sale.status <> 'delivered_paid' then
      raise exception 'Solo una venta entregada y cobrada puede pasar a devuelta.';
    end if;
    perform public.admin_return_sale_stock(p_sale_id);
  end if;

  update public.sales s
  set status = v_new_status,
      updated_at = now()
  where s.id = p_sale_id
  returning s.* into v_sale;

  if nullif(btrim(coalesce(p_notes, '')), '') is not null then
    insert into public.sale_events (sale_id, event_type, to_status, notes, actor_id)
    values (p_sale_id, 'status_note', v_new_status, nullif(btrim(p_notes), ''), auth.uid());
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
  v_movement_id uuid;
  v_created_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can manage inventory';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_movement_type not in ('manual_entry', 'manual_exit', 'adjustment_in', 'adjustment_out', 'damaged', 'lost') then
    raise exception 'Invalid manual inventory movement type';
  end if;

  if v_reason is null then
    raise exception 'Movement reason is required';
  end if;

  v_delta := case
    when p_movement_type in ('manual_entry', 'adjustment_in') then p_quantity
    else -p_quantity
  end;

  select coalesce(p.stock_quantity, 0), coalesce(p.reserved_stock_quantity, 0), coalesce(p.cost_price, 0)
  into v_stock_before, v_reserved, v_product_cost
  from public.products p
  where p.id = p_product_id
  for update;

  if v_stock_before is null then
    raise exception 'Producto no encontrado.';
  end if;

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
    coalesce(nullif(btrim(p_source_type), ''), 'manual'),
    p_source_id,
    v_uid
  )
  returning id, inventory_movements.created_at
  into v_movement_id, v_created_at;

  update public.products
  set stock_quantity = v_stock_after,
      updated_at = now()
  where id = p_product_id;

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
  v_status text := coalesce(nullif(btrim(p_status), ''), 'pending_contact');
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

  if v_status not in ('pending_contact', 'confirmed', 'preparing', 'out_for_delivery') then
    raise exception 'Sales can be commercially saved only before delivery';
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
      status = v_status,
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

    delete from public.sale_items where sale_id = v_sale_id;
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
      v_status,
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

  if v_status in ('confirmed', 'preparing', 'out_for_delivery') then
    perform public.admin_reserve_sale_stock(v_sale_id);
  end if;

  return v_sale_id;
end;
$$;

create or replace function public.current_commission_period_py()
returns table (
  period_start date,
  period_end date,
  payment_day date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Asuncion')::date;
  v_start date;
begin
  v_start := v_today - ((extract(isodow from v_today)::integer + 6) % 7);
  period_start := v_start;
  period_end := v_start + 5;
  payment_day := v_start + 7;
  return next;
end;
$$;

create or replace function public.prepare_commission_payment_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'paid' then
    raise exception 'Paid commission payments cannot be modified';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.reseller_id
      and p.role = 'reseller'
  ) then
    raise exception 'commission payment reseller_id must belong to a reseller profile';
  end if;

  new.gross_commission := greatest(coalesce(new.gross_commission, 0), 0);
  new.adjustments := greatest(coalesce(new.adjustments, 0), 0);
  new.discounts := greatest(coalesce(new.discounts, 0), 0);
  new.net_paid := greatest(new.gross_commission + new.adjustments - new.discounts, 0);
  new.updated_at := now();

  return new;
end;
$$;

create or replace function public.admin_ensure_commission_batches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can manage commission batches';
  end if;

  with periods as (
    select distinct
      ((s.delivered_at at time zone 'America/Asuncion')::date - ((extract(isodow from (s.delivered_at at time zone 'America/Asuncion')::date)::integer + 6) % 7))::date as period_start
    from public.sales s
    join public.profiles p on p.id = s.reseller_id
    where s.sale_type = 'reseller'
      and p.role = 'reseller'
      and s.status = 'delivered_paid'
      and coalesce(s.commission_paid, false) = false
      and s.delivered_at is not null
      and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) between 1 and 6
  ),
  inserted as (
    insert into public.commission_batches (period_start, period_end, payment_day, status, created_by, notes)
    select
      period_start,
      period_start + 5,
      period_start + 7,
      'draft',
      auth.uid(),
      'Creado automaticamente desde ventas elegibles'
    from periods
    on conflict (period_start, period_end) do nothing
    returning id
  )
  select count(*) into v_count from inserted;

  return v_count;
end;
$$;

create or replace function public.admin_get_commission_batch_overview(p_batch_id uuid default null)
returns table (
  batch_id uuid,
  period_start date,
  period_end date,
  payment_day date,
  batch_status text,
  reseller_id uuid,
  reseller_code text,
  reseller_name text,
  reseller_email text,
  reseller_phone text,
  sales_count bigint,
  gross_commission numeric,
  pending_adjustments numeric,
  net_commission numeric,
  has_bank_account boolean,
  can_pay boolean,
  reason text,
  is_current_period boolean,
  is_payable_today boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Asuncion')::date;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view commission overview';
  end if;

  perform public.admin_ensure_commission_batches();

  return query
  with current_period as (
    select * from public.current_commission_period_py()
  ),
  eligible_sales as (
    select
      b.id as batch_id,
      s.reseller_id,
      count(*) as sales_count,
      coalesce(sum(s.reseller_commission), 0) as gross_commission
    from public.commission_batches b
    join public.sales s on s.sale_type = 'reseller'
      and s.status = 'delivered_paid'
      and coalesce(s.commission_paid, false) = false
      and s.delivered_at is not null
      and (s.delivered_at at time zone 'America/Asuncion')::date >= b.period_start
      and (s.delivered_at at time zone 'America/Asuncion')::date <= b.period_end
      and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) between 1 and 6
    join public.profiles pr on pr.id = s.reseller_id and pr.role = 'reseller'
    where (p_batch_id is null or b.id = p_batch_id)
      and not exists (
        select 1
        from public.commission_payment_items item
        join public.commission_payments payment on payment.id = item.payment_id
        where item.sale_id = s.id
          and payment.status <> 'cancelled'
      )
    group by b.id, s.reseller_id
  ),
  adjustments as (
    select
      a.reseller_id,
      coalesce(sum(a.remaining_amount), 0) as pending_adjustments
    from public.commission_adjustments a
    where a.status = 'pending'
    group by a.reseller_id
  )
  select
    b.id,
    b.period_start,
    b.period_end,
    b.payment_day,
    b.status,
    e.reseller_id,
    p.reseller_code,
    p.full_name,
    p.email,
    p.phone,
    e.sales_count,
    e.gross_commission,
    coalesce(a.pending_adjustments, 0),
    greatest(e.gross_commission + coalesce(a.pending_adjustments, 0), 0),
    ba.id is not null,
    ba.id is not null
      and greatest(e.gross_commission + coalesce(a.pending_adjustments, 0), 0) > 0
      and v_today >= b.payment_day,
    case
      when ba.id is null then 'Sin cuenta bancaria'
      when v_today < b.payment_day then 'Todavia no es dia de pago'
      when greatest(e.gross_commission + coalesce(a.pending_adjustments, 0), 0) <= 0 then 'El neto queda en cero por ajustes pendientes'
      else 'Listo para pagar'
    end,
    exists (select 1 from current_period cp where cp.period_start = b.period_start),
    v_today >= b.payment_day
  from eligible_sales e
  join public.commission_batches b on b.id = e.batch_id
  join public.profiles p on p.id = e.reseller_id
  left join public.bank_accounts ba on ba.reseller_id = e.reseller_id and ba.is_primary = true
  left join adjustments a on a.reseller_id = e.reseller_id
  order by b.period_start desc, p.full_name asc;
end;
$$;

create or replace function public.admin_get_commission_batch_sales(
  p_batch_id uuid,
  p_reseller_id uuid
)
returns table (
  id uuid,
  reseller_id uuid,
  product_name_snapshot text,
  reseller_commission numeric,
  delivered_at timestamptz,
  commission_paid boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.commission_batches%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view commission sales';
  end if;

  select *
  into v_batch
  from public.commission_batches b
  where b.id = p_batch_id;

  if v_batch.id is null then
    raise exception 'Commission batch not found';
  end if;

  return query
  select
    s.id,
    s.reseller_id,
    s.product_name_snapshot,
    s.reseller_commission,
    s.delivered_at,
    coalesce(s.commission_paid, false)
  from public.sales s
  join public.profiles p on p.id = s.reseller_id and p.role = 'reseller'
  where s.reseller_id = p_reseller_id
    and s.sale_type = 'reseller'
    and s.status = 'delivered_paid'
    and coalesce(s.commission_paid, false) = false
    and s.delivered_at is not null
    and (s.delivered_at at time zone 'America/Asuncion')::date >= v_batch.period_start
    and (s.delivered_at at time zone 'America/Asuncion')::date <= v_batch.period_end
    and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) between 1 and 6
    and not exists (
      select 1
      from public.commission_payment_items item
      join public.commission_payments payment on payment.id = item.payment_id
      where item.sale_id = s.id
        and payment.status <> 'cancelled'
    )
  order by s.delivered_at asc, s.id asc;
end;
$$;

create or replace function public.admin_get_sunday_commission_warnings()
returns table (
  sale_id uuid,
  reseller_id uuid,
  reseller_name text,
  product_name text,
  delivered_at timestamptz,
  reseller_commission numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view commission warnings';
  end if;

  return query
  select
    s.id,
    s.reseller_id,
    p.full_name,
    s.product_name_snapshot,
    s.delivered_at,
    s.reseller_commission
  from public.sales s
  join public.profiles p on p.id = s.reseller_id
  where s.sale_type = 'reseller'
    and s.status = 'delivered_paid'
    and coalesce(s.commission_paid, false) = false
    and s.delivered_at is not null
    and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) = 7
  order by s.delivered_at desc;
end;
$$;

create or replace function public.create_commission_payment(
  p_batch_id uuid,
  p_reseller_id uuid,
  p_sale_ids uuid[],
  p_adjustments numeric default 0,
  p_discounts numeric default 0,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_batch public.commission_batches%rowtype;
  v_expected_count integer;
  v_valid_count integer;
  v_gross numeric(14,2);
  v_bank public.bank_accounts%rowtype;
  v_adjustment record;
  v_manual_adjustments numeric(14,2) := greatest(coalesce(p_adjustments, 0), 0);
  v_discounts numeric(14,2) := greatest(coalesce(p_discounts, 0), 0);
  v_adjustments_to_apply numeric(14,2) := 0;
  v_remaining_capacity numeric(14,2);
  v_apply_amount numeric(14,2);
begin
  if not public.is_admin() then
    raise exception 'Only active admins can create commission payments';
  end if;

  if p_sale_ids is null or cardinality(p_sale_ids) = 0 then
    raise exception 'At least one sale is required';
  end if;

  select *
  into v_batch
  from public.commission_batches b
  where b.id = p_batch_id
  for update;

  if v_batch.id is null then
    raise exception 'Commission batch not found';
  end if;

  if v_batch.status in ('paid', 'cancelled') then
    raise exception 'This commission batch does not accept new payments';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_reseller_id
      and p.role = 'reseller'
  ) then
    raise exception 'Reseller profile is required';
  end if;

  select *
  into v_bank
  from public.bank_accounts b
  where b.reseller_id = p_reseller_id
    and b.is_primary = true
  limit 1;

  if v_bank.id is null then
    raise exception 'El revendedor no tiene cuenta bancaria cargada.';
  end if;

  select count(distinct sale_id)
  into v_expected_count
  from unnest(p_sale_ids) as sale_id;

  select count(*), coalesce(sum(s.reseller_commission), 0)
  into v_valid_count, v_gross
  from public.sales s
  join public.profiles p on p.id = s.reseller_id and p.role = 'reseller'
  where s.id = any(p_sale_ids)
    and s.reseller_id = p_reseller_id
    and s.sale_type = 'reseller'
    and s.status = 'delivered_paid'
    and coalesce(s.commission_paid, false) = false
    and (s.delivered_at at time zone 'America/Asuncion')::date >= v_batch.period_start
    and (s.delivered_at at time zone 'America/Asuncion')::date <= v_batch.period_end
    and extract(isodow from (s.delivered_at at time zone 'America/Asuncion')) between 1 and 6
    and not exists (
      select 1
      from public.commission_payment_items item
      join public.commission_payments payment on payment.id = item.payment_id
      where item.sale_id = s.id
        and payment.status <> 'cancelled'
    );

  if v_valid_count <> v_expected_count then
    raise exception 'One or more sales are not eligible for this commission payment';
  end if;

  v_remaining_capacity := greatest(v_gross + v_manual_adjustments - v_discounts, 0);

  for v_adjustment in
    select *
    from public.commission_adjustments a
    where a.reseller_id = p_reseller_id
      and a.status = 'pending'
      and a.remaining_amount < 0
    order by a.created_at asc, a.id asc
    for update
  loop
    exit when v_remaining_capacity <= 0;
    v_apply_amount := -least(abs(v_adjustment.remaining_amount), v_remaining_capacity);
    v_adjustments_to_apply := v_adjustments_to_apply + v_apply_amount;
    v_remaining_capacity := v_remaining_capacity + v_apply_amount;
  end loop;

  insert into public.commission_payments (
    batch_id,
    reseller_id,
    bank_name_snapshot,
    bank_alias_snapshot,
    bank_holder_snapshot,
    bank_document_snapshot,
    gross_commission,
    adjustments,
    discounts,
    net_paid,
    status,
    created_by,
    notes
  )
  values (
    p_batch_id,
    p_reseller_id,
    v_bank.bank_name,
    v_bank.bank_alias,
    v_bank.bank_holder,
    v_bank.bank_document,
    v_gross,
    v_manual_adjustments,
    v_discounts + abs(v_adjustments_to_apply),
    greatest(v_gross + v_manual_adjustments + v_adjustments_to_apply - v_discounts, 0),
    'pending',
    auth.uid(),
    nullif(btrim(p_notes), '')
  )
  returning id into v_payment_id;

  insert into public.commission_payment_items (payment_id, sale_id, commission_amount_snapshot)
  select v_payment_id, s.id, s.reseller_commission
  from public.sales s
  where s.id = any(p_sale_ids)
  order by s.delivered_at, s.id;

  v_remaining_capacity := greatest(v_gross + v_manual_adjustments - v_discounts, 0);
  for v_adjustment in
    select *
    from public.commission_adjustments a
    where a.reseller_id = p_reseller_id
      and a.status = 'pending'
      and a.remaining_amount < 0
    order by a.created_at asc, a.id asc
    for update
  loop
    exit when v_remaining_capacity <= 0;
    v_apply_amount := -least(abs(v_adjustment.remaining_amount), v_remaining_capacity);

    insert into public.commission_payment_adjustments (payment_id, adjustment_id, amount_applied)
    values (v_payment_id, v_adjustment.id, v_apply_amount);

    update public.commission_adjustments a
    set remaining_amount = a.remaining_amount - v_apply_amount,
        status = case when a.remaining_amount - v_apply_amount = 0 then 'applied' else 'pending' end,
        updated_at = now()
    where a.id = v_adjustment.id;

    v_remaining_capacity := v_remaining_capacity + v_apply_amount;
  end loop;

  perform public.recalculate_commission_batch_status(p_batch_id);

  return v_payment_id;
end;
$$;

create or replace function public.mark_commission_payment_paid(
  p_payment_id uuid,
  p_payment_date date,
  p_payment_method text default null,
  p_voucher_url text default null,
  p_voucher_number text default null,
  p_notes text default null
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
begin
  if not public.is_admin() then
    raise exception 'Only active admins can confirm commission payments';
  end if;

  if p_payment_date is null then
    raise exception 'payment_date is required';
  end if;

  select *
  into v_payment
  from public.commission_payments p
  where p.id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'Commission payment not found';
  end if;

  if v_payment.status = 'paid' then
    return p_payment_id;
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'Only pending commission payments can be marked as paid';
  end if;

  select count(*)
  into v_item_count
  from public.commission_payment_items item
  where item.payment_id = p_payment_id;

  if v_item_count = 0 then
    raise exception 'Cannot pay a commission payment without items';
  end if;

  update public.commission_payments p
  set status = 'paid',
      payment_date = p_payment_date,
      payment_method = nullif(btrim(p_payment_method), ''),
      voucher_url = nullif(btrim(p_voucher_url), ''),
      voucher_number = nullif(btrim(p_voucher_number), ''),
      notes = coalesce(nullif(btrim(p_notes), ''), p.notes),
      updated_at = now()
  where p.id = p_payment_id;

  update public.sales s
  set commission_paid = true,
      commission_paid_at = p_payment_date::timestamp at time zone 'America/Asuncion',
      commission_payment_id = p_payment_id,
      updated_at = now()
  where s.id in (
    select item.sale_id
    from public.commission_payment_items item
    where item.payment_id = p_payment_id
    )
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

create or replace function public.admin_create_commission_payments_bulk(
  p_batch_id uuid,
  p_reseller_ids uuid[],
  p_payment_date date,
  p_payment_method text default null,
  p_voucher_url text default null,
  p_voucher_number text default null,
  p_notes text default null
)
returns table (
  payment_id uuid,
  reseller_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reseller_id uuid;
  v_sale_ids uuid[];
  v_payment_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can pay commissions';
  end if;

  if p_reseller_ids is null or cardinality(p_reseller_ids) = 0 then
    raise exception 'Select at least one reseller';
  end if;

  if exists (
    select 1
    from unnest(p_reseller_ids) as selected_reseller(reseller_id)
    left join public.bank_accounts b on b.reseller_id = selected_reseller.reseller_id and b.is_primary = true
    where b.id is null
  ) then
    raise exception 'Todos los revendedores seleccionados deben tener cuenta bancaria.';
  end if;

  for v_reseller_id in select distinct selected_reseller.reseller_id from unnest(p_reseller_ids) as selected_reseller(reseller_id)
  loop
    select array_agg(s.id order by s.delivered_at, s.id)
    into v_sale_ids
    from public.admin_get_commission_batch_sales(p_batch_id, v_reseller_id) s;

    if v_sale_ids is not null and cardinality(v_sale_ids) > 0 then
      v_payment_id := public.create_commission_payment(
        p_batch_id,
        v_reseller_id,
        v_sale_ids,
        0,
        0,
        p_notes
      );
      perform public.mark_commission_payment_paid(
        v_payment_id,
        p_payment_date,
        p_payment_method,
        p_voucher_url,
        p_voucher_number,
        p_notes
      );
      payment_id := v_payment_id;
      reseller_id := v_reseller_id;
      return next;
    end if;
  end loop;
end;
$$;

drop trigger if exists sale_stock_reservations_prepare_row on public.sale_stock_reservations;
create trigger sale_stock_reservations_prepare_row
before insert or update on public.sale_stock_reservations
for each row execute function public.prepare_sale_stock_reservation_row();

do $$
declare
  v_conflict record;
begin
  select
    p.id as product_id,
    coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0) as available,
    n.quantity as required
  into v_conflict
  from (
    select i.product_id, sum(i.quantity)::integer as quantity
    from public.sales s
    join public.sale_items i on i.sale_id = s.id
    join public.product_admin_details d on d.product_id = i.product_id
    where s.status in ('confirmed', 'preparing', 'out_for_delivery')
      and coalesce(d.track_inventory, true) = true
      and not exists (
        select 1
        from public.sale_stock_reservations r
        where r.sale_item_id = i.id
          and r.status = 'active'
      )
    group by i.product_id
  ) n
  join public.products p on p.id = n.product_id
  where coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0) < n.quantity
  limit 1;

  if v_conflict.product_id is not null then
    raise exception 'No se puede migrar reservas: producto % tiene disponible % y requiere %',
      v_conflict.product_id, v_conflict.available, v_conflict.required;
  end if;
end;
$$;

insert into public.sale_stock_reservations (
  sale_id,
  sale_item_id,
  product_id,
  location_id,
  quantity,
  status,
  reserved_at
)
select
  s.id,
  i.id,
  i.product_id,
  public.admin_default_inventory_location(),
  i.quantity,
  'active',
  now()
from public.sales s
join public.sale_items i on i.sale_id = s.id
join public.product_admin_details d on d.product_id = i.product_id
where s.status in ('confirmed', 'preparing', 'out_for_delivery')
  and coalesce(d.track_inventory, true) = true
  and not exists (
    select 1
    from public.sale_stock_reservations r
    where r.sale_item_id = i.id
      and r.status = 'active'
  );

update public.products p
set reserved_stock_quantity = coalesce(r.quantity, 0),
    updated_at = now()
from (
  select product_id, sum(quantity)::integer as quantity
  from public.sale_stock_reservations
  where status = 'active'
  group by product_id
) r
where p.id = r.product_id;

update public.products p
set reserved_stock_quantity = 0,
    updated_at = now()
where not exists (
  select 1
  from public.sale_stock_reservations r
  where r.product_id = p.id
    and r.status = 'active'
);

drop policy if exists "Admins can read sale stock reservations" on public.sale_stock_reservations;
create policy "Admins can read sale stock reservations"
on public.sale_stock_reservations for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert sale stock reservations" on public.sale_stock_reservations;
drop policy if exists "Admins can update sale stock reservations" on public.sale_stock_reservations;
drop policy if exists "Admins can delete sale stock reservations" on public.sale_stock_reservations;

drop policy if exists "Admins can read commission adjustments" on public.commission_adjustments;
create policy "Admins can read commission adjustments"
on public.commission_adjustments for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own commission adjustments" on public.commission_adjustments;
create policy "Resellers can read own commission adjustments"
on public.commission_adjustments for select to authenticated
using (reseller_id = auth.uid());

drop policy if exists "Admins can insert commission adjustments" on public.commission_adjustments;
drop policy if exists "Admins can update commission adjustments" on public.commission_adjustments;

drop policy if exists "Admins can read commission payment adjustments" on public.commission_payment_adjustments;
create policy "Admins can read commission payment adjustments"
on public.commission_payment_adjustments for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own commission payment adjustments" on public.commission_payment_adjustments;
create policy "Resellers can read own commission payment adjustments"
on public.commission_payment_adjustments for select to authenticated
using (
  exists (
    select 1
    from public.commission_payments p
    where p.id = commission_payment_adjustments.payment_id
      and p.reseller_id = auth.uid()
  )
);

drop policy if exists "Admins can insert commission payment adjustments" on public.commission_payment_adjustments;
drop policy if exists "Admins can update commission payment adjustments" on public.commission_payment_adjustments;

alter function public.admin_default_inventory_location() owner to postgres;
alter function public.recalculate_product_reserved_stock(uuid) owner to postgres;
alter function public.admin_release_sale_stock(uuid) owner to postgres;
alter function public.admin_reserve_sale_stock(uuid) owner to postgres;
alter function public.admin_consume_sale_stock(uuid) owner to postgres;
alter function public.admin_return_sale_stock(uuid) owner to postgres;
alter function public.admin_remove_sale_from_pending_commission_payment(uuid) owner to postgres;
alter function public.admin_create_return_commission_adjustment(uuid) owner to postgres;
alter function public.admin_transition_sale_status(uuid, text, text) owner to postgres;
alter function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) owner to postgres;
alter function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text) owner to postgres;
alter function public.current_commission_period_py() owner to postgres;
alter function public.prepare_commission_payment_row() owner to postgres;
alter function public.admin_ensure_commission_batches() owner to postgres;
alter function public.admin_get_commission_batch_overview(uuid) owner to postgres;
alter function public.admin_get_commission_batch_sales(uuid, uuid) owner to postgres;
alter function public.admin_get_sunday_commission_warnings() owner to postgres;
alter function public.create_commission_payment(uuid, uuid, uuid[], numeric, numeric, text) owner to postgres;
alter function public.mark_commission_payment_paid(uuid, date, text, text, text, text) owner to postgres;
alter function public.admin_create_commission_payments_bulk(uuid, uuid[], date, text, text, text, text) owner to postgres;

revoke all on function public.admin_default_inventory_location() from public;
revoke all on function public.recalculate_product_reserved_stock(uuid) from public;
revoke all on function public.admin_release_sale_stock(uuid) from public;
revoke all on function public.admin_reserve_sale_stock(uuid) from public;
revoke all on function public.admin_consume_sale_stock(uuid) from public;
revoke all on function public.admin_return_sale_stock(uuid) from public;
revoke all on function public.admin_remove_sale_from_pending_commission_payment(uuid) from public;
revoke all on function public.admin_create_return_commission_adjustment(uuid) from public;
revoke all on function public.admin_transition_sale_status(uuid, text, text) from public;
revoke all on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) from public;
revoke all on function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text) from public;
revoke all on function public.current_commission_period_py() from public;
revoke all on function public.prepare_commission_payment_row() from public;
revoke all on function public.admin_ensure_commission_batches() from public;
revoke all on function public.admin_get_commission_batch_overview(uuid) from public;
revoke all on function public.admin_get_commission_batch_sales(uuid, uuid) from public;
revoke all on function public.admin_get_sunday_commission_warnings() from public;
revoke all on function public.create_commission_payment(uuid, uuid, uuid[], numeric, numeric, text) from public;
revoke all on function public.mark_commission_payment_paid(uuid, date, text, text, text, text) from public;
revoke all on function public.admin_create_commission_payments_bulk(uuid, uuid[], date, text, text, text, text) from public;

grant execute on function public.admin_transition_sale_status(uuid, text, text) to authenticated;
grant execute on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) to authenticated;
grant execute on function public.admin_save_sale(uuid, text, uuid, uuid, jsonb, text, numeric, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.current_commission_period_py() to authenticated;
grant execute on function public.admin_ensure_commission_batches() to authenticated;
grant execute on function public.admin_get_commission_batch_overview(uuid) to authenticated;
grant execute on function public.admin_get_commission_batch_sales(uuid, uuid) to authenticated;
grant execute on function public.admin_get_sunday_commission_warnings() to authenticated;
grant execute on function public.create_commission_payment(uuid, uuid, uuid[], numeric, numeric, text) to authenticated;
grant execute on function public.mark_commission_payment_paid(uuid, date, text, text, text, text) to authenticated;
grant execute on function public.admin_create_commission_payments_bulk(uuid, uuid[], date, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
