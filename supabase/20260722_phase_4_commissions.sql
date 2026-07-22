-- Camaraza Store Re-venta - Fase 4: comisiones, cierres semanales y pagos.
-- Ejecutar manualmente despues de Fase 3.
-- No crea gastos generales, flujo de caja completo, inventario, rankings, logros ni bonos.

BEGIN;

alter table public.sales
  add column if not exists commission_paid boolean not null default false,
  add column if not exists commission_paid_at timestamptz,
  add column if not exists commission_payment_id uuid;

create table if not exists public.commission_batches (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  payment_day date not null,
  status text not null default 'draft',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  constraint commission_batches_status_check check (status in ('draft', 'ready', 'paid', 'cancelled')),
  constraint commission_batches_period_order_check check (period_end >= period_start),
  constraint commission_batches_period_unique unique (period_start, period_end)
);

create table if not exists public.commission_payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.commission_batches(id),
  reseller_id uuid not null references public.profiles(id),
  bank_name_snapshot text,
  bank_alias_snapshot text,
  bank_holder_snapshot text,
  bank_document_snapshot text,
  gross_commission numeric(14,2) not null default 0,
  adjustments numeric(14,2) not null default 0,
  discounts numeric(14,2) not null default 0,
  net_paid numeric(14,2) not null default 0,
  payment_date date,
  payment_method text,
  voucher_url text,
  voucher_number text,
  status text not null default 'pending',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  constraint commission_payments_status_check check (status in ('pending', 'paid', 'cancelled')),
  constraint commission_payments_amounts_check check (
    gross_commission >= 0
    and adjustments >= 0
    and discounts >= 0
    and net_paid >= 0
  ),
  constraint commission_payments_reseller_unique unique (batch_id, reseller_id)
);

create table if not exists public.commission_payment_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.commission_payments(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  commission_amount_snapshot numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint commission_payment_items_amount_check check (commission_amount_snapshot >= 0),
  constraint commission_payment_items_sale_unique unique (sale_id)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.profiles(id) on delete cascade,
  bank_name text not null,
  bank_alias text,
  bank_holder text not null,
  bank_document text,
  account_type text,
  is_primary boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_accounts_primary_unique unique (reseller_id, is_primary) deferrable initially immediate
);

create table if not exists public.commission_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.commission_batches(id) on delete restrict,
  payment_id uuid references public.commission_payments(id) on delete restrict,
  actor_id uuid references auth.users(id),
  event_type text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.sales
  drop constraint if exists sales_commission_payment_fk;

alter table public.sales
  add constraint sales_commission_payment_fk
  foreign key (commission_payment_id) references public.commission_payments(id) on delete set null;

create or replace view public.reseller_sales
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
where s.reseller_id = auth.uid();

revoke all on public.reseller_sales from public;
grant select on public.reseller_sales to authenticated;

create index if not exists commission_batches_status_idx on public.commission_batches(status);
create index if not exists commission_batches_payment_day_idx on public.commission_batches(payment_day);
create index if not exists commission_payments_batch_id_idx on public.commission_payments(batch_id);
create index if not exists commission_payments_reseller_id_idx on public.commission_payments(reseller_id);
create index if not exists commission_payments_status_idx on public.commission_payments(status);
create index if not exists commission_payment_items_payment_id_idx on public.commission_payment_items(payment_id);
create index if not exists commission_payment_items_sale_id_idx on public.commission_payment_items(sale_id);
create index if not exists bank_accounts_reseller_id_idx on public.bank_accounts(reseller_id);
create index if not exists commission_events_batch_id_idx on public.commission_events(batch_id);
create index if not exists commission_events_payment_id_idx on public.commission_events(payment_id);

alter table public.commission_batches enable row level security;
alter table public.commission_payments enable row level security;
alter table public.commission_payment_items enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.commission_events enable row level security;

create or replace function public.prepare_commission_batch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.period_end < new.period_start then
    raise exception 'commission batch period_end must be after period_start';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_commission_payment_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reseller_ok boolean;
  has_items boolean;
begin
  if tg_op = 'UPDATE' and old.status = 'paid' then
    raise exception 'Paid commission payments cannot be modified';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = new.reseller_id
      and p.role = 'reseller'
      and p.is_active = true
  )
  into reseller_ok;

  if not reseller_ok then
    raise exception 'commission payment reseller_id must belong to an active reseller';
  end if;

  new.gross_commission := greatest(coalesce(new.gross_commission, 0), 0);
  new.adjustments := greatest(coalesce(new.adjustments, 0), 0);
  new.discounts := greatest(coalesce(new.discounts, 0), 0);
  new.net_paid := greatest(new.gross_commission + new.adjustments - new.discounts, 0);
  new.updated_at := now();

  if new.status = 'paid' and new.payment_date is null then
    new.payment_date := current_date;
  end if;

  if tg_op = 'UPDATE' and new.status = 'paid' then
    select exists (
      select 1 from public.commission_payment_items item
      where item.payment_id = new.id
    )
    into has_items;

    if not has_items then
      raise exception 'Cannot mark commission payment as paid without items';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prepare_commission_payment_item_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  payment_status text;
  payment_reseller_id uuid;
  sale_ok boolean;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Commission payment items cannot be modified';
  end if;

  select p.status, p.reseller_id
  into payment_status, payment_reseller_id
  from public.commission_payments p
  where p.id = new.payment_id;

  if payment_status is null then
    raise exception 'Commission payment not found';
  end if;

  if payment_status = 'paid' then
    raise exception 'Cannot add items to a paid commission payment';
  end if;

  select exists (
    select 1
    from public.sales s
    where s.id = new.sale_id
      and s.reseller_id = payment_reseller_id
      and s.status = 'delivered_paid'
      and s.commission_paid = false
  )
  into sale_ok;

  if not sale_ok then
    raise exception 'Sale is not eligible for commission payment';
  end if;

  new.commission_amount_snapshot := greatest(coalesce(new.commission_amount_snapshot, 0), 0);
  return new;
end;
$$;

create or replace function public.prepare_bank_account_row()
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
    raise exception 'bank account reseller_id must belong to an active reseller';
  end if;

  new.bank_name := nullif(btrim(new.bank_name), '');
  new.bank_holder := nullif(btrim(new.bank_holder), '');
  if new.bank_name is null or new.bank_holder is null then
    raise exception 'bank name and holder are required';
  end if;

  new.is_primary := true;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.log_commission_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'commission_batches' and tg_op = 'INSERT' then
    insert into public.commission_events (batch_id, actor_id, event_type, notes)
    values (new.id, auth.uid(), 'batch_created', new.notes);
  elsif tg_table_name = 'commission_payments' and tg_op = 'INSERT' then
    insert into public.commission_events (batch_id, payment_id, actor_id, event_type, notes)
    values (new.batch_id, new.id, auth.uid(), 'payment_created', new.notes);
  elsif tg_table_name = 'commission_payments' and tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from new.status then
    insert into public.commission_events (batch_id, payment_id, actor_id, event_type, notes)
    values (new.batch_id, new.id, auth.uid(), 'payment_cancelled', new.notes);
  elsif tg_table_name = 'commission_payments' and tg_op = 'UPDATE' and new.voucher_url is distinct from old.voucher_url then
    insert into public.commission_events (batch_id, payment_id, actor_id, event_type, notes)
    values (new.batch_id, new.id, auth.uid(), 'voucher_uploaded', new.voucher_number);
  elsif tg_table_name = 'commission_payments' and tg_op = 'UPDATE' and new.adjustments is distinct from old.adjustments then
    insert into public.commission_events (batch_id, payment_id, actor_id, event_type, notes)
    values (new.batch_id, new.id, auth.uid(), 'adjustment_added', new.notes);
  end if;
  return new;
end;
$$;

create or replace function public.mark_sales_commission_paid()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    update public.sales s
    set commission_paid = true,
        commission_paid_at = now(),
        commission_payment_id = new.id,
        updated_at = now()
    where s.id in (
      select item.sale_id
      from public.commission_payment_items item
      where item.payment_id = new.id
    )
      and s.commission_paid = false;
  end if;
  return new;
end;
$$;

create or replace function public.refresh_commission_payment_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.commission_payments p
  set gross_commission = coalesce((
        select sum(item.commission_amount_snapshot)
        from public.commission_payment_items item
        where item.payment_id = new.payment_id
      ), 0),
      updated_at = now()
  where p.id = new.payment_id
    and p.status <> 'paid';

  return new;
end;
$$;

drop trigger if exists commission_batches_prepare_row on public.commission_batches;
create trigger commission_batches_prepare_row
before insert or update on public.commission_batches
for each row execute function public.prepare_commission_batch_row();

drop trigger if exists commission_payments_prepare_row on public.commission_payments;
create trigger commission_payments_prepare_row
before insert or update on public.commission_payments
for each row execute function public.prepare_commission_payment_row();

drop trigger if exists commission_payment_items_prepare_row on public.commission_payment_items;
create trigger commission_payment_items_prepare_row
before insert or update on public.commission_payment_items
for each row execute function public.prepare_commission_payment_item_row();

drop trigger if exists commission_payment_items_refresh_total on public.commission_payment_items;
create trigger commission_payment_items_refresh_total
after insert on public.commission_payment_items
for each row execute function public.refresh_commission_payment_total();

drop trigger if exists bank_accounts_prepare_row on public.bank_accounts;
create trigger bank_accounts_prepare_row
before insert or update on public.bank_accounts
for each row execute function public.prepare_bank_account_row();

drop trigger if exists commission_batches_log_event on public.commission_batches;
create trigger commission_batches_log_event
after insert on public.commission_batches
for each row execute function public.log_commission_event();

drop trigger if exists commission_payments_log_event on public.commission_payments;
create trigger commission_payments_log_event
after insert or update on public.commission_payments
for each row execute function public.log_commission_event();

drop trigger if exists commission_payments_mark_sales_paid on public.commission_payments;
create trigger commission_payments_mark_sales_paid
after update on public.commission_payments
for each row execute function public.mark_sales_commission_paid();

-- Commission batches RLS
drop policy if exists "Admins can read commission batches" on public.commission_batches;
create policy "Admins can read commission batches"
on public.commission_batches for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own commission batches" on public.commission_batches;
create policy "Resellers can read own commission batches"
on public.commission_batches for select to authenticated
using (
  exists (
    select 1 from public.commission_payments p
    where p.batch_id = commission_batches.id
      and p.reseller_id = auth.uid()
  )
);

drop policy if exists "Admins can insert commission batches" on public.commission_batches;
create policy "Admins can insert commission batches"
on public.commission_batches for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "Admins can update commission batches" on public.commission_batches;
create policy "Admins can update commission batches"
on public.commission_batches for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Commission payments RLS
drop policy if exists "Admins can read commission payments" on public.commission_payments;
create policy "Admins can read commission payments"
on public.commission_payments for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own commission payments" on public.commission_payments;
create policy "Resellers can read own commission payments"
on public.commission_payments for select to authenticated
using (reseller_id = auth.uid());

drop policy if exists "Admins can insert commission payments" on public.commission_payments;
create policy "Admins can insert commission payments"
on public.commission_payments for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "Admins can update commission payments" on public.commission_payments;
create policy "Admins can update commission payments"
on public.commission_payments for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Commission payment items RLS
drop policy if exists "Admins can read commission payment items" on public.commission_payment_items;
create policy "Admins can read commission payment items"
on public.commission_payment_items for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own commission payment items" on public.commission_payment_items;
create policy "Resellers can read own commission payment items"
on public.commission_payment_items for select to authenticated
using (
  exists (
    select 1 from public.commission_payments p
    where p.id = commission_payment_items.payment_id
      and p.reseller_id = auth.uid()
  )
);

drop policy if exists "Admins can insert commission payment items" on public.commission_payment_items;
create policy "Admins can insert commission payment items"
on public.commission_payment_items for insert to authenticated
with check (public.is_admin());

-- Bank accounts RLS
drop policy if exists "Admins can read all bank accounts" on public.bank_accounts;
create policy "Admins can read all bank accounts"
on public.bank_accounts for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own bank account" on public.bank_accounts;
create policy "Resellers can read own bank account"
on public.bank_accounts for select to authenticated
using (reseller_id = auth.uid());

drop policy if exists "Admins can insert bank accounts" on public.bank_accounts;
create policy "Admins can insert bank accounts"
on public.bank_accounts for insert to authenticated
with check (public.is_admin());

drop policy if exists "Resellers can insert own bank account" on public.bank_accounts;
create policy "Resellers can insert own bank account"
on public.bank_accounts for insert to authenticated
with check (reseller_id = auth.uid());

drop policy if exists "Admins can update bank accounts" on public.bank_accounts;
create policy "Admins can update bank accounts"
on public.bank_accounts for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Resellers can update own bank account" on public.bank_accounts;
create policy "Resellers can update own bank account"
on public.bank_accounts for update to authenticated
using (reseller_id = auth.uid())
with check (reseller_id = auth.uid());

-- Commission events RLS
drop policy if exists "Admins can read commission events" on public.commission_events;
create policy "Admins can read commission events"
on public.commission_events for select to authenticated
using (public.is_admin());

drop policy if exists "Resellers can read own commission events" on public.commission_events;
create policy "Resellers can read own commission events"
on public.commission_events for select to authenticated
using (
  exists (
    select 1 from public.commission_payments p
    where p.id = commission_events.payment_id
      and p.reseller_id = auth.uid()
  )
);

drop policy if exists "Admins can insert commission events" on public.commission_events;
create policy "Admins can insert commission events"
on public.commission_events for insert to authenticated
with check (public.is_admin());

notify pgrst, 'reload schema';

COMMIT;
