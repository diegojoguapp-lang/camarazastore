-- Camaraza Store Re-venta - Fase 4: comisiones, cierres semanales y pagos.
-- Ejecutar manualmente despues de Fase 3.
-- No crea gastos generales, flujo de caja completo, inventario, rankings, logros ni bonos.

begin;

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
  notes text
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
  notes text
);

create table if not exists public.commission_payment_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.commission_payments(id) on delete restrict,
  sale_id uuid not null references public.sales(id) on delete restrict,
  commission_amount_snapshot numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
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

alter table public.commission_batches drop constraint if exists commission_batches_status_check;
alter table public.commission_batches
  add constraint commission_batches_status_check
  check (status in ('draft', 'ready', 'paid', 'cancelled'));

alter table public.commission_batches drop constraint if exists commission_batches_period_order_check;
alter table public.commission_batches drop constraint if exists commission_batches_period_valid_check;
alter table public.commission_batches
  add constraint commission_batches_period_valid_check
  check (
    extract(isodow from period_start) = 1
    and extract(isodow from period_end) = 6
    and period_end = period_start + 5
  );

alter table public.commission_batches drop constraint if exists commission_batches_payment_day_check;
alter table public.commission_batches
  add constraint commission_batches_payment_day_check
  check (
    extract(isodow from payment_day) = 1
    and payment_day = period_start + 7
  );

alter table public.commission_batches drop constraint if exists commission_batches_period_unique;
alter table public.commission_batches
  add constraint commission_batches_period_unique unique (period_start, period_end);

alter table public.commission_payments drop constraint if exists commission_payments_status_check;
alter table public.commission_payments
  add constraint commission_payments_status_check
  check (status in ('pending', 'paid', 'cancelled'));

alter table public.commission_payments drop constraint if exists commission_payments_amounts_check;
alter table public.commission_payments
  add constraint commission_payments_amounts_check
  check (
    gross_commission >= 0
    and adjustments >= 0
    and discounts >= 0
    and net_paid >= 0
  );

alter table public.commission_payments drop constraint if exists commission_payments_paid_date_check;
alter table public.commission_payments
  add constraint commission_payments_paid_date_check
  check (status <> 'paid' or payment_date is not null);

alter table public.commission_payments drop constraint if exists commission_payments_reseller_unique;
drop index if exists public.commission_payments_active_reseller_unique;
create unique index commission_payments_active_reseller_unique
on public.commission_payments(batch_id, reseller_id)
where status <> 'cancelled';

alter table public.commission_payment_items drop constraint if exists commission_payment_items_amount_check;
alter table public.commission_payment_items
  add constraint commission_payment_items_amount_check
  check (commission_amount_snapshot >= 0);

alter table public.commission_payment_items drop constraint if exists commission_payment_items_sale_unique;
alter table public.commission_payment_items
  add constraint commission_payment_items_sale_unique unique (sale_id);

alter table public.sales drop constraint if exists sales_commission_payment_fk;
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
declare
  active_count integer;
  paid_count integer;
begin
  if new.status = 'paid' then
    select
      count(*) filter (where p.status <> 'cancelled'),
      count(*) filter (where p.status = 'paid')
    into active_count, paid_count
    from public.commission_payments p
    where p.batch_id = new.id;

    if active_count = 0 or paid_count <> active_count then
      raise exception 'A commission batch can be paid only when all active payments are paid';
    end if;
  end if;

  new.updated_at := now();
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

  if payment_status <> 'pending' then
    raise exception 'Cannot add items to a non-pending commission payment';
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

create or replace function public.recalculate_commission_batch_status(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  active_count integer;
  paid_count integer;
begin
  select b.status
  into current_status
  from public.commission_batches b
  where b.id = p_batch_id
  for update;

  if current_status is null or current_status = 'cancelled' then
    return;
  end if;

  select
    count(*) filter (where p.status <> 'cancelled'),
    count(*) filter (where p.status = 'paid')
  into active_count, paid_count
  from public.commission_payments p
  where p.batch_id = p_batch_id;

  update public.commission_batches b
  set status = case
      when active_count = 0 then 'draft'
      when paid_count = active_count then 'paid'
      else 'ready'
    end,
    updated_at = now()
  where b.id = p_batch_id;
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
  elsif tg_table_name = 'commission_payments' and tg_op = 'UPDATE' and new.voucher_url is distinct from old.voucher_url and new.voucher_url is not null then
    insert into public.commission_events (batch_id, payment_id, actor_id, event_type, notes)
    values (new.batch_id, new.id, auth.uid(), 'voucher_uploaded', new.voucher_number);
  elsif tg_table_name = 'commission_payments' and tg_op = 'UPDATE' and new.adjustments is distinct from old.adjustments and new.adjustments > 0 then
    insert into public.commission_events (batch_id, payment_id, actor_id, event_type, notes)
    values (new.batch_id, new.id, auth.uid(), 'adjustment_added', new.notes);
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
    and p.status = 'pending';

  return new;
end;
$$;

create or replace function public.refresh_commission_batch_status_from_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.recalculate_commission_batch_status(new.batch_id);
  return new;
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
  v_reseller_ok boolean;
  v_expected_count integer;
  v_valid_count integer;
  v_gross numeric(14,2);
  v_bank public.bank_accounts%rowtype;
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

  select exists (
    select 1
    from public.profiles p
    where p.id = p_reseller_id
      and p.role = 'reseller'
      and p.is_active = true
  )
  into v_reseller_ok;

  if not v_reseller_ok then
    raise exception 'Reseller must be active';
  end if;

  select count(distinct sale_id)
  into v_expected_count
  from unnest(p_sale_ids) as sale_id;

  select count(*), coalesce(sum(s.reseller_commission), 0)
  into v_valid_count, v_gross
  from public.sales s
  where s.id = any(p_sale_ids)
    and s.reseller_id = p_reseller_id
    and s.status = 'delivered_paid'
    and s.commission_paid = false
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

  select *
  into v_bank
  from public.bank_accounts b
  where b.reseller_id = p_reseller_id
    and b.is_primary = true
  limit 1;

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
    greatest(coalesce(p_adjustments, 0), 0),
    greatest(coalesce(p_discounts, 0), 0),
    greatest(v_gross + greatest(coalesce(p_adjustments, 0), 0) - greatest(coalesce(p_discounts, 0), 0), 0),
    'pending',
    auth.uid(),
    nullif(btrim(p_notes), '')
  )
  returning id into v_payment_id;

  insert into public.commission_payment_items (
    payment_id,
    sale_id,
    commission_amount_snapshot
  )
  select
    v_payment_id,
    s.id,
    s.reseller_commission
  from public.sales s
  where s.id = any(p_sale_ids)
  order by s.delivered_at, s.id;

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

create or replace function public.cancel_commission_payment(
  p_payment_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.commission_payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can cancel commission payments';
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
    raise exception 'Paid commission payments require an explicit reversal flow';
  end if;

  if v_payment.status = 'cancelled' then
    return p_payment_id;
  end if;

  delete from public.commission_payment_items item
  where item.payment_id = p_payment_id;

  update public.commission_payments p
  set status = 'cancelled',
      notes = coalesce(nullif(btrim(p_notes), ''), p.notes),
      updated_at = now()
  where p.id = p_payment_id;

  perform public.recalculate_commission_batch_status(v_payment.batch_id);

  return p_payment_id;
end;
$$;

alter function public.recalculate_commission_batch_status(uuid) owner to postgres;
alter function public.create_commission_payment(uuid, uuid, uuid[], numeric, numeric, text) owner to postgres;
alter function public.mark_commission_payment_paid(uuid, date, text, text, text, text) owner to postgres;
alter function public.cancel_commission_payment(uuid, text) owner to postgres;

revoke all on function public.recalculate_commission_batch_status(uuid) from public;
revoke all on function public.create_commission_payment(uuid, uuid, uuid[], numeric, numeric, text) from public;
revoke all on function public.mark_commission_payment_paid(uuid, date, text, text, text, text) from public;
revoke all on function public.cancel_commission_payment(uuid, text) from public;

grant execute on function public.create_commission_payment(uuid, uuid, uuid[], numeric, numeric, text) to authenticated;
grant execute on function public.mark_commission_payment_paid(uuid, date, text, text, text, text) to authenticated;
grant execute on function public.cancel_commission_payment(uuid, text) to authenticated;

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
drop function if exists public.mark_sales_commission_paid();

drop trigger if exists commission_payments_refresh_batch_status on public.commission_payments;
create trigger commission_payments_refresh_batch_status
after insert or update on public.commission_payments
for each row execute function public.refresh_commission_batch_status_from_payment();

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
drop policy if exists "Admins can update commission payments" on public.commission_payments;

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

commit;
