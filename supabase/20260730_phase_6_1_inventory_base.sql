-- Camaraza Store Re-venta - Fase 6.1: inventario base, proveedores y datos internos de producto.
-- Ejecutar manualmente despues de Fase 5.
-- No conecta inventario con ventas, comisiones, compras, caja ni finanzas.

begin;

create extension if not exists pgcrypto;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  city text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_admin_details (
  product_id uuid primary key references public.products(id) on delete cascade,
  sku text,
  retail_price numeric(14,2),
  supplier_id uuid references public.suppliers(id) on delete set null,
  track_inventory boolean not null default true,
  low_stock_threshold integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  movement_type text not null,
  quantity_delta integer not null,
  stock_before integer not null,
  stock_after integer not null,
  unit_cost_snapshot numeric(14,2),
  reason text not null,
  notes text,
  source_type text not null default 'manual',
  source_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (
    movement_type in (
      'opening_balance',
      'manual_entry',
      'manual_exit',
      'adjustment_in',
      'adjustment_out',
      'damaged',
      'lost'
    )
  ),
  constraint inventory_movements_delta_check check (quantity_delta <> 0),
  constraint inventory_movements_direction_check check (
    (
      movement_type in ('opening_balance', 'manual_entry', 'adjustment_in')
      and quantity_delta > 0
    )
    or (
      movement_type in ('manual_exit', 'adjustment_out', 'damaged', 'lost')
      and quantity_delta < 0
    )
  ),
  constraint inventory_movements_stock_check check (
    stock_before >= 0
    and stock_after >= 0
    and stock_after = stock_before + quantity_delta
  ),
  constraint inventory_movements_cost_check check (
    unit_cost_snapshot is null or unit_cost_snapshot >= 0
  )
);

alter table public.product_admin_details drop constraint if exists product_admin_details_values_check;
alter table public.product_admin_details
  add constraint product_admin_details_values_check check (
    (retail_price is null or retail_price >= 0)
    and low_stock_threshold >= 0
  );

create unique index if not exists product_admin_details_sku_unique_idx
  on public.product_admin_details (lower(sku))
  where sku is not null;

drop index if exists public.inventory_locations_default_unique_idx;
create unique index inventory_locations_default_unique_idx
  on public.inventory_locations (is_default)
  where is_default = true;

create index if not exists suppliers_active_idx on public.suppliers(is_active);
create index if not exists suppliers_name_idx on public.suppliers(name);
create index if not exists product_admin_details_supplier_id_idx on public.product_admin_details(supplier_id);
create index if not exists inventory_movements_product_id_idx on public.inventory_movements(product_id);
create index if not exists inventory_movements_location_id_idx on public.inventory_movements(location_id);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements(created_at desc);
create index if not exists inventory_movements_source_idx on public.inventory_movements(source_type, source_id);

insert into public.inventory_locations (name, code, is_default, is_active)
values ('Depósito principal', 'MAIN', true, true)
on conflict (code) do update
set
  name = excluded.name,
  is_default = true,
  is_active = true,
  updated_at = now();

update public.inventory_locations
set is_default = false,
    updated_at = now()
where code is distinct from 'MAIN'
  and is_default = true;

create or replace function public.prepare_supplier_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := nullif(btrim(new.name), '');
  new.contact_name := nullif(btrim(new.contact_name), '');
  new.phone := nullif(btrim(new.phone), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.city := nullif(btrim(new.city), '');
  new.address := nullif(btrim(new.address), '');
  new.notes := nullif(btrim(new.notes), '');
  new.is_active := coalesce(new.is_active, true);
  new.updated_at := now();

  if new.name is null then
    raise exception 'Supplier name is required';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  return new;
end;
$$;

create or replace function public.prepare_inventory_location_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := nullif(btrim(new.name), '');
  new.code := nullif(upper(btrim(new.code)), '');
  new.is_default := coalesce(new.is_default, false);
  new.is_active := coalesce(new.is_active, true);
  new.updated_at := now();

  if new.name is null then
    raise exception 'Inventory location name is required';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_product_admin_details_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sku := nullif(regexp_replace(btrim(coalesce(new.sku, '')), '\s+', ' ', 'g'), '');
  new.track_inventory := coalesce(new.track_inventory, true);
  new.low_stock_threshold := coalesce(new.low_stock_threshold, 2);
  new.updated_at := now();

  if new.retail_price is not null and new.retail_price < 0 then
    raise exception 'Retail price cannot be negative';
  end if;

  if new.low_stock_threshold < 0 then
    raise exception 'Low stock threshold cannot be negative';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_product_admin_details()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.product_admin_details (product_id)
  values (new.id)
  on conflict (product_id) do nothing;

  if new.stock_quantity is null then
    update public.products
    set stock_quantity = 0
    where id = new.id
      and stock_quantity is null;
  end if;

  return new;
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

  select coalesce(p.stock_quantity, 0), coalesce(p.cost_price, 0)
  into v_stock_before, v_product_cost
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

alter function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) owner to postgres;
revoke all on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) from public;
grant execute on function public.admin_create_inventory_movement(uuid, text, integer, text, text, uuid, numeric, text, uuid) to authenticated;

drop trigger if exists suppliers_prepare_row on public.suppliers;
create trigger suppliers_prepare_row
before insert or update on public.suppliers
for each row execute function public.prepare_supplier_row();

drop trigger if exists inventory_locations_prepare_row on public.inventory_locations;
create trigger inventory_locations_prepare_row
before insert or update on public.inventory_locations
for each row execute function public.prepare_inventory_location_row();

drop trigger if exists product_admin_details_prepare_row on public.product_admin_details;
create trigger product_admin_details_prepare_row
before insert or update on public.product_admin_details
for each row execute function public.prepare_product_admin_details_row();

drop trigger if exists products_ensure_admin_details on public.products;
create trigger products_ensure_admin_details
after insert on public.products
for each row execute function public.ensure_product_admin_details();

do $$
begin
  if exists (
    select 1
    from public.products
    where stock_quantity < 0
  ) then
    raise exception 'No se puede habilitar inventario: existen productos con stock negativo.';
  end if;
end;
$$;

insert into public.product_admin_details (product_id)
select p.id
from public.products p
on conflict (product_id) do nothing;

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
  created_by
)
select
  p.id,
  l.id,
  'opening_balance',
  p.stock_quantity,
  0,
  p.stock_quantity,
  p.cost_price,
  'Saldo inicial desde stock existente',
  'Creado por migración Fase 6.1 sin modificar el stock actual',
  'migration_phase_6_1',
  null
from public.products p
cross join lateral (
  select id
  from public.inventory_locations
  where is_default = true
  order by created_at asc
  limit 1
) l
where coalesce(p.stock_quantity, 0) > 0
  and not exists (
    select 1
    from public.inventory_movements m
    where m.product_id = p.id
      and m.movement_type = 'opening_balance'
      and m.source_type = 'migration_phase_6_1'
  );

alter table public.suppliers enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.product_admin_details enable row level security;
alter table public.inventory_movements enable row level security;

-- Suppliers RLS
drop policy if exists "Admins can read suppliers" on public.suppliers;
create policy "Admins can read suppliers"
on public.suppliers for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert suppliers" on public.suppliers;
create policy "Admins can insert suppliers"
on public.suppliers for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update suppliers" on public.suppliers;
create policy "Admins can update suppliers"
on public.suppliers for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Inventory locations RLS
drop policy if exists "Admins can read inventory locations" on public.inventory_locations;
create policy "Admins can read inventory locations"
on public.inventory_locations for select to authenticated
using (public.is_admin());

-- Product admin details RLS
drop policy if exists "Admins can read product admin details" on public.product_admin_details;
create policy "Admins can read product admin details"
on public.product_admin_details for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert product admin details" on public.product_admin_details;
create policy "Admins can insert product admin details"
on public.product_admin_details for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update product admin details" on public.product_admin_details;
create policy "Admins can update product admin details"
on public.product_admin_details for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Inventory movements RLS. No insert policy: creation must go through
-- public.admin_create_inventory_movement() so stock and movement stay transactional.
drop policy if exists "Admins can read inventory movements" on public.inventory_movements;
create policy "Admins can read inventory movements"
on public.inventory_movements for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert inventory movements" on public.inventory_movements;

notify pgrst, 'reload schema';

commit;
