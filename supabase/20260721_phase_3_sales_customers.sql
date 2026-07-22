-- Camaraza Store Re-venta - Fase 3: clientes, ventas y comisiones por venta.
-- Ejecutar manualmente despues de Fase 1 y Fase 2.
-- No crea pagos semanales, gastos, flujo de caja, inventario avanzado ni usuarios repartidores.

begin;

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  normalized_phone text not null,
  city text,
  neighborhood text,
  address text,
  map_url text,
  reference text,
  requires_advance_payment boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id),
  customer_id uuid not null references public.customers(id),
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  product_model_snapshot text,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'pending_contact',
  admin_notes text,
  reseller_visible_notes text,
  created_by uuid not null references auth.users(id),
  product_sale_price numeric(14,2) not null default 0,
  product_cost numeric(14,2) not null default 0,
  delivery_charged numeric(14,2) not null default 0,
  delivery_cost numeric(14,2) not null default 0,
  reseller_commission numeric(14,2) not null default 0,
  other_costs numeric(14,2) not null default 0,
  total_collected numeric(14,2) not null default 0,
  camaraza_net_profit numeric(14,2) not null default 0,
  ordered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivery_city text,
  delivery_neighborhood text,
  delivery_address text,
  delivery_map_url text,
  delivery_reference text,
  delivery_schedule text,
  payment_method text,
  amount_received numeric(14,2) not null default 0,
  constraint sales_status_check check (
    status in (
      'pending_contact',
      'confirmed',
      'preparing',
      'out_for_delivery',
      'delivered_paid',
      'cancelled',
      'failed_delivery',
      'returned'
    )
  ),
  constraint sales_amounts_non_negative_check check (
    product_sale_price >= 0
    and product_cost >= 0
    and delivery_charged >= 0
    and delivery_cost >= 0
    and reseller_commission >= 0
    and other_costs >= 0
    and total_collected >= 0
    and amount_received >= 0
  )
);

alter table public.sales
  drop constraint if exists sales_amounts_non_negative_check;

alter table public.sales
  add constraint sales_amounts_non_negative_check check (
    product_sale_price >= 0
    and product_cost >= 0
    and delivery_charged >= 0
    and delivery_cost >= 0
    and reseller_commission >= 0
    and other_costs >= 0
    and total_collected >= 0
    and amount_received >= 0
  );

create table if not exists public.sale_events (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  from_status text,
  to_status text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists customers_normalized_phone_idx on public.customers(normalized_phone);
create index if not exists sales_reseller_id_idx on public.sales(reseller_id);
create index if not exists sales_customer_id_idx on public.sales(customer_id);
create index if not exists sales_status_idx on public.sales(status);
create index if not exists sales_created_at_idx on public.sales(created_at);
create index if not exists sales_delivered_at_idx on public.sales(delivered_at);
create index if not exists sale_events_sale_id_idx on public.sale_events(sale_id);

alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_events enable row level security;

create or replace function public.normalize_customer_phone(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(value, ''), '[^0-9]+', '', 'g')
$$;

create or replace function public.prepare_customer_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := nullif(btrim(new.full_name), '');
  new.phone := nullif(btrim(new.phone), '');
  new.normalized_phone := public.normalize_customer_phone(coalesce(new.normalized_phone, new.phone));
  new.updated_at := now();

  if new.full_name is null then
    raise exception 'Customer full_name is required';
  end if;

  if new.phone is null or new.normalized_phone = '' then
    raise exception 'Customer phone is required';
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
  reseller_ok boolean;
begin
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

  new.product_name_snapshot := nullif(btrim(new.product_name_snapshot), '');
  if new.product_name_snapshot is null then
    raise exception 'Sale product_name_snapshot is required';
  end if;

  new.product_sale_price := greatest(coalesce(new.product_sale_price, 0), 0);
  new.product_cost := greatest(coalesce(new.product_cost, 0), 0);
  new.delivery_charged := greatest(coalesce(new.delivery_charged, 0), 0);
  new.delivery_cost := greatest(coalesce(new.delivery_cost, 0), 0);
  new.reseller_commission := greatest(coalesce(new.reseller_commission, 0), 0);
  new.other_costs := greatest(coalesce(new.other_costs, 0), 0);
  new.amount_received := greatest(coalesce(new.amount_received, 0), 0);

  new.total_collected := new.product_sale_price + new.delivery_charged;
  new.camaraza_net_profit :=
    new.product_sale_price
    - new.product_cost
    - new.reseller_commission
    + new.delivery_charged
    - new.delivery_cost
    - new.other_costs;
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

create or replace function public.log_sale_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.sale_events (sale_id, actor_id, event_type, to_status, notes)
    values (new.id, auth.uid(), 'sale_created', new.status, 'Venta creada');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.sale_events (sale_id, actor_id, event_type, from_status, to_status, notes)
    values (new.id, auth.uid(), 'status_changed', old.status, new.status, 'Estado actualizado');
  elsif (
    new.product_sale_price is distinct from old.product_sale_price
    or new.product_cost is distinct from old.product_cost
    or new.delivery_charged is distinct from old.delivery_charged
    or new.delivery_cost is distinct from old.delivery_cost
    or new.reseller_commission is distinct from old.reseller_commission
    or new.other_costs is distinct from old.other_costs
  ) then
    insert into public.sale_events (sale_id, actor_id, event_type, notes)
    values (new.id, auth.uid(), 'amount_modified', 'Montos actualizados');
  end if;

  return new;
end;
$$;

drop trigger if exists customers_prepare_row on public.customers;
create trigger customers_prepare_row
before insert or update on public.customers
for each row execute function public.prepare_customer_row();

drop trigger if exists sales_prepare_row on public.sales;
create trigger sales_prepare_row
before insert or update on public.sales
for each row execute function public.prepare_sale_row();

drop trigger if exists sales_log_event on public.sales;
create trigger sales_log_event
after insert or update on public.sales
for each row execute function public.log_sale_event();

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
  c.city as customer_city
from public.sales s
join public.customers c on c.id = s.customer_id
where s.reseller_id = auth.uid();

revoke all on public.reseller_sales from public;
grant select on public.reseller_sales to authenticated;

-- Customers RLS
drop policy if exists "Admins can read all customers" on public.customers;
create policy "Admins can read all customers"
on public.customers
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert customers" on public.customers;
create policy "Admins can insert customers"
on public.customers
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update customers" on public.customers;
create policy "Admins can update customers"
on public.customers
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Sales RLS
drop policy if exists "Admins can read all sales" on public.sales;
create policy "Admins can read all sales"
on public.sales
for select
to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own sales" on public.sales;
create policy "Resellers can read own sales"
on public.sales
for select
to authenticated
using (reseller_id = auth.uid());

drop policy if exists "Admins can insert sales" on public.sales;
create policy "Admins can insert sales"
on public.sales
for insert
to authenticated
with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "Admins can update sales" on public.sales;
create policy "Admins can update sales"
on public.sales
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No delete policy for sales in this phase.

-- Sale events RLS
drop policy if exists "Admins can read all sale events" on public.sale_events;
create policy "Admins can read all sale events"
on public.sale_events
for select
to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own sale events" on public.sale_events;
create policy "Resellers can read own sale events"
on public.sale_events
for select
to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_events.sale_id
      and s.reseller_id = auth.uid()
  )
);

drop policy if exists "Admins can insert sale events" on public.sale_events;
create policy "Admins can insert sale events"
on public.sale_events
for insert
to authenticated
with check (public.is_admin());

notify pgrst, 'reload schema';

commit;
