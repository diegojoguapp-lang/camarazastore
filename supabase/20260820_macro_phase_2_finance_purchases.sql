-- Camaraza Store - MacroFase 2: finanzas, caja, gastos, compras y reportes.
-- Ejecutar manualmente despues de MacroFase 1.
-- No genera movimientos financieros retroactivos para ventas o pagos antiguos.

begin;

create extension if not exists pgcrypto;

alter table public.sales
  add column if not exists financial_account_id uuid,
  add column if not exists financial_income_movement_id uuid;

create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null default 'cash',
  bank_name text,
  account_number text,
  account_holder text,
  initial_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  is_cash_account boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_accounts_type_check check (account_type in ('cash', 'bank', 'wallet', 'other')),
  constraint financial_accounts_initial_balance_check check (initial_balance >= 0)
);

create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.financial_accounts(id) on delete restrict,
  movement_type text not null,
  direction text not null,
  amount numeric(14,2) not null,
  description text not null,
  source_type text not null default 'manual',
  source_id uuid,
  reference text,
  transfer_id uuid,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  reversed_movement_id uuid references public.financial_movements(id) on delete restrict,
  is_reversal boolean not null default false,
  constraint financial_movements_direction_check check (direction in ('income', 'expense')),
  constraint financial_movements_amount_check check (amount > 0),
  constraint financial_movements_type_check check (movement_type in (
    'opening_balance',
    'sale_income',
    'commission_payment',
    'expense',
    'cash_adjustment',
    'manual_income',
    'manual_expense',
    'purchase_payment',
    'transfer_in',
    'transfer_out',
    'reversal'
  ))
);

alter table public.sales drop constraint if exists sales_financial_account_fk;
alter table public.sales
  add constraint sales_financial_account_fk
  foreign key (financial_account_id) references public.financial_accounts(id) on delete restrict;

alter table public.sales drop constraint if exists sales_financial_income_movement_fk;
alter table public.sales
  add constraint sales_financial_income_movement_fk
  foreign key (financial_income_movement_id) references public.financial_movements(id) on delete restrict;

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.expense_categories(id) on delete restrict,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  description text not null,
  amount numeric(14,2) not null,
  expense_date date not null default ((now() at time zone 'America/Asuncion')::date),
  notes text,
  status text not null default 'confirmed',
  financial_movement_id uuid references public.financial_movements(id) on delete restrict,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  constraint expenses_amount_check check (amount > 0),
  constraint expenses_status_check check (status in ('confirmed', 'cancelled'))
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null references public.financial_accounts(id) on delete restrict,
  opened_at timestamptz not null default now(),
  opening_expected_balance numeric(14,2) not null default 0,
  opening_counted_balance numeric(14,2) not null default 0,
  opening_difference numeric(14,2) not null default 0,
  closed_at timestamptz,
  closing_expected_balance numeric(14,2),
  closing_counted_balance numeric(14,2),
  closing_difference numeric(14,2),
  status text not null default 'open',
  opened_by uuid references auth.users(id),
  closed_by uuid references auth.users(id),
  notes text,
  constraint cash_sessions_status_check check (status in ('open', 'closed'))
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_date date not null default ((now() at time zone 'America/Asuncion')::date),
  status text not null default 'draft',
  notes text,
  total_amount numeric(14,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  financial_account_id uuid references public.financial_accounts(id) on delete restrict,
  financial_movement_id uuid references public.financial_movements(id) on delete restrict,
  payment_registered boolean not null default false,
  constraint purchases_status_check check (status in ('draft', 'confirmed', 'cancelled')),
  constraint purchases_total_check check (total_amount >= 0)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  quantity integer not null,
  unit_cost numeric(14,2) not null,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint purchase_items_quantity_check check (quantity > 0),
  constraint purchase_items_amount_check check (unit_cost >= 0 and line_total >= 0)
);

alter table public.commission_payments
  add column if not exists financial_account_id uuid references public.financial_accounts(id) on delete restrict,
  add column if not exists financial_movement_id uuid references public.financial_movements(id) on delete restrict;

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
      'sale_return',
      'purchase_entry'
    )
  );

alter table public.inventory_movements drop constraint if exists inventory_movements_direction_check;
alter table public.inventory_movements
  add constraint inventory_movements_direction_check check (
    (
      movement_type in ('opening_balance', 'manual_entry', 'adjustment_in', 'sale_return', 'purchase_entry')
      and quantity_delta > 0
    )
    or (
      movement_type in ('manual_exit', 'adjustment_out', 'damaged', 'lost', 'sale_delivery')
      and quantity_delta < 0
    )
  );

drop index if exists public.financial_movements_auto_source_unique_idx;
create unique index financial_movements_auto_source_unique_idx
on public.financial_movements(source_type, source_id, movement_type)
where source_id is not null
  and movement_type in ('opening_balance', 'sale_income', 'commission_payment', 'expense', 'purchase_payment')
  and is_reversal = false;

drop index if exists public.financial_movements_reversal_unique_idx;
create unique index financial_movements_reversal_unique_idx
on public.financial_movements(reversed_movement_id)
where reversed_movement_id is not null and is_reversal = true;

drop index if exists public.inventory_movements_purchase_item_unique_idx;
create unique index inventory_movements_purchase_item_unique_idx
on public.inventory_movements(source_type, source_id, movement_type)
where source_type = 'purchase_item'
  and source_id is not null
  and movement_type = 'purchase_entry';

drop index if exists public.cash_sessions_open_unique_idx;
create unique index cash_sessions_open_unique_idx
on public.cash_sessions(financial_account_id)
where status = 'open';

create index if not exists financial_accounts_active_idx on public.financial_accounts(is_active, sort_order);
create index if not exists financial_movements_account_date_idx on public.financial_movements(account_id, occurred_at desc);
create index if not exists financial_movements_source_idx on public.financial_movements(source_type, source_id);
create index if not exists expenses_date_idx on public.expenses(expense_date desc);
create index if not exists expenses_category_idx on public.expenses(category_id);
create index if not exists purchases_date_idx on public.purchases(purchase_date desc);
create index if not exists purchases_status_idx on public.purchases(status);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);
create index if not exists purchase_items_product_idx on public.purchase_items(product_id);

alter table public.financial_accounts enable row level security;
alter table public.financial_movements enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

insert into public.expense_categories (name, sort_order)
values
  ('Publicidad', 10),
  ('Salarios', 20),
  ('Combustible', 30),
  ('Packaging', 40),
  ('Alquiler', 50),
  ('Servicios', 60),
  ('Transporte', 70),
  ('Mantenimiento', 80),
  ('Compras', 90),
  ('Perdidas', 100),
  ('Otros', 110)
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

create or replace function public.prepare_financial_account_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := nullif(btrim(new.name), '');
  new.account_type := coalesce(nullif(btrim(new.account_type), ''), 'cash');
  new.bank_name := nullif(btrim(new.bank_name), '');
  new.account_number := nullif(btrim(new.account_number), '');
  new.account_holder := nullif(btrim(new.account_holder), '');
  new.initial_balance := greatest(coalesce(new.initial_balance, 0), 0);
  new.is_active := coalesce(new.is_active, true);
  new.is_cash_account := coalesce(new.is_cash_account, new.account_type = 'cash');
  new.sort_order := coalesce(new.sort_order, 0);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if new.name is null then
    raise exception 'Financial account name is required';
  end if;
  if new.account_type not in ('cash', 'bank', 'wallet', 'other') then
    raise exception 'Invalid financial account type';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_financial_movement_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Financial movements are immutable. Use reversal or adjustment.';
  end if;
  new.amount := coalesce(new.amount, 0);
  new.description := nullif(btrim(new.description), '');
  new.source_type := coalesce(nullif(btrim(new.source_type), ''), 'manual');
  new.occurred_at := coalesce(new.occurred_at, now());
  new.created_by := coalesce(new.created_by, auth.uid());
  if new.amount <= 0 then
    raise exception 'Financial movement amount must be greater than zero';
  end if;
  if new.description is null then
    raise exception 'Financial movement description is required';
  end if;
  if new.direction not in ('income', 'expense') then
    raise exception 'Invalid financial movement direction';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_expense_category_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := nullif(btrim(new.name), '');
  new.is_active := coalesce(new.is_active, true);
  new.sort_order := coalesce(new.sort_order, 0);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  if new.name is null then
    raise exception 'Expense category name is required';
  end if;
  return new;
end;
$$;

create or replace function public.prepare_purchase_item_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_product record;
begin
  select p.name
  into v_product
  from public.products p
  where p.id = new.product_id;
  if v_product.name is null then
    raise exception 'Purchase item product does not exist';
  end if;
  new.product_name_snapshot := coalesce(nullif(btrim(new.product_name_snapshot), ''), v_product.name);
  new.quantity := coalesce(new.quantity, 0);
  new.unit_cost := greatest(coalesce(new.unit_cost, 0), 0);
  if new.quantity <= 0 then
    raise exception 'Purchase item quantity must be greater than zero';
  end if;
  new.line_total := new.quantity * new.unit_cost;
  return new;
end;
$$;

create or replace function public.recalculate_purchase_total(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.purchases p
  set total_amount = coalesce((
        select sum(i.line_total)
        from public.purchase_items i
        where i.purchase_id = p_purchase_id
      ), 0),
      updated_at = now()
  where p.id = p_purchase_id;
end;
$$;

create or replace function public.refresh_purchase_total_from_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.recalculate_purchase_total(coalesce(new.purchase_id, old.purchase_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.get_financial_account_balances()
returns table (
  id uuid,
  name text,
  account_type text,
  bank_name text,
  is_active boolean,
  is_cash_account boolean,
  sort_order integer,
  initial_balance numeric,
  current_balance numeric,
  income_total numeric,
  expense_total numeric,
  movement_count bigint,
  last_activity timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view financial accounts';
  end if;

  return query
  select
    a.id,
    a.name,
    a.account_type,
    a.bank_name,
    a.is_active,
    a.is_cash_account,
    a.sort_order,
    a.initial_balance,
    a.initial_balance
      + coalesce(sum(case when m.direction = 'income' and m.movement_type <> 'opening_balance' then m.amount else 0 end), 0)
      - coalesce(sum(case when m.direction = 'expense' then m.amount else 0 end), 0) as current_balance,
    coalesce(sum(case when m.direction = 'income' and m.movement_type <> 'opening_balance' then m.amount else 0 end), 0) as income_total,
    coalesce(sum(case when m.direction = 'expense' then m.amount else 0 end), 0) as expense_total,
    count(m.id) as movement_count,
    max(m.occurred_at) as last_activity
  from public.financial_accounts a
  left join public.financial_movements m on m.account_id = a.id
  group by a.id
  order by a.sort_order asc, a.name asc;
end;
$$;

create or replace function public.admin_save_financial_account(
  p_account_id uuid default null,
  p_name text default null,
  p_account_type text default 'cash',
  p_bank_name text default null,
  p_account_number text default null,
  p_account_holder text default null,
  p_initial_balance numeric default 0,
  p_is_active boolean default true,
  p_is_cash_account boolean default false,
  p_sort_order integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing_movements integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can manage financial accounts';
  end if;

  if p_account_id is not null then
    select count(*) into v_existing_movements
    from public.financial_movements m
    where m.account_id = p_account_id;

    update public.financial_accounts
    set name = p_name,
        account_type = p_account_type,
        bank_name = p_bank_name,
        account_number = p_account_number,
        account_holder = p_account_holder,
        initial_balance = case when v_existing_movements = 0 then greatest(coalesce(p_initial_balance, 0), 0) else initial_balance end,
        is_active = coalesce(p_is_active, true),
        is_cash_account = coalesce(p_is_cash_account, false),
        sort_order = coalesce(p_sort_order, 0),
        updated_at = now()
    where id = p_account_id
    returning id into v_id;
  else
    insert into public.financial_accounts (
      name, account_type, bank_name, account_number, account_holder, initial_balance,
      is_active, is_cash_account, sort_order, created_by
    )
    values (
      p_name, p_account_type, p_bank_name, p_account_number, p_account_holder, greatest(coalesce(p_initial_balance, 0), 0),
      coalesce(p_is_active, true), coalesce(p_is_cash_account, false), coalesce(p_sort_order, 0), auth.uid()
    )
    returning id into v_id;

    if coalesce(p_initial_balance, 0) > 0 then
      insert into public.financial_movements (
        account_id, movement_type, direction, amount, description, source_type, source_id, occurred_at, created_by
      )
      values (
        v_id, 'opening_balance', 'income', p_initial_balance, 'Saldo inicial del sistema', 'financial_account', v_id, now(), auth.uid()
      );
    end if;
  end if;

  if v_id is null then
    raise exception 'Financial account not found';
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_create_financial_movement(
  p_account_id uuid,
  p_direction text,
  p_amount numeric,
  p_description text,
  p_movement_type text default null,
  p_occurred_at timestamptz default null,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_type text;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can create financial movements';
  end if;
  if not exists (select 1 from public.financial_accounts a where a.id = p_account_id and a.is_active = true) then
    raise exception 'Financial account not found or inactive';
  end if;
  if p_direction not in ('income', 'expense') then
    raise exception 'Invalid movement direction';
  end if;
  v_type := coalesce(nullif(btrim(p_movement_type), ''), case when p_direction = 'income' then 'manual_income' else 'manual_expense' end);
  if v_type not in ('manual_income', 'manual_expense', 'cash_adjustment') then
    raise exception 'Invalid manual movement type';
  end if;

  insert into public.financial_movements (
    account_id, movement_type, direction, amount, description, source_type, reference, occurred_at, created_by
  )
  values (
    p_account_id, v_type, p_direction, p_amount, p_description, 'manual', nullif(btrim(p_reference), ''), coalesce(p_occurred_at, now()), auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_create_account_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_description text default null,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer_id uuid := gen_random_uuid();
  v_description text := coalesce(nullif(btrim(p_description), ''), 'Transferencia entre cuentas');
begin
  if not public.is_admin() then
    raise exception 'Only active admins can transfer money';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'La cuenta origen y destino no pueden ser iguales.';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;
  if not exists (select 1 from public.financial_accounts where id = p_from_account_id and is_active = true) then
    raise exception 'Origin account not found or inactive';
  end if;
  if not exists (select 1 from public.financial_accounts where id = p_to_account_id and is_active = true) then
    raise exception 'Destination account not found or inactive';
  end if;

  insert into public.financial_movements (account_id, movement_type, direction, amount, description, source_type, transfer_id, occurred_at, created_by)
  values
    (p_from_account_id, 'transfer_out', 'expense', p_amount, v_description, 'transfer', v_transfer_id, coalesce(p_occurred_at, now()), auth.uid()),
    (p_to_account_id, 'transfer_in', 'income', p_amount, v_description, 'transfer', v_transfer_id, coalesce(p_occurred_at, now()), auth.uid());

  return v_transfer_id;
end;
$$;

create or replace function public.admin_reverse_financial_movement(
  p_movement_id uuid,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.financial_movements%rowtype;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can reverse financial movements';
  end if;
  select * into v_original from public.financial_movements where id = p_movement_id for update;
  if v_original.id is null then
    raise exception 'Financial movement not found';
  end if;
  if exists (select 1 from public.financial_movements where reversed_movement_id = p_movement_id and is_reversal = true) then
    select id into v_id from public.financial_movements where reversed_movement_id = p_movement_id and is_reversal = true limit 1;
    return v_id;
  end if;

  insert into public.financial_movements (
    account_id, movement_type, direction, amount, description, source_type, source_id, reference, occurred_at, created_by, reversed_movement_id, is_reversal
  )
  values (
    v_original.account_id,
    'reversal',
    case when v_original.direction = 'income' then 'expense' else 'income' end,
    v_original.amount,
    coalesce(nullif(btrim(p_description), ''), 'Reverso: ' || v_original.description),
    v_original.source_type,
    v_original.source_id,
    v_original.reference,
    now(),
    auth.uid(),
    v_original.id,
    true
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_create_sale_income(
  p_sale_id uuid,
  p_financial_account_id uuid,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  v_movement_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can register sale income';
  end if;
  if p_financial_account_id is null then
    raise exception 'Selecciona la cuenta financiera donde ingreso el cobro.';
  end if;
  if p_payment_method not in ('cash', 'transfer', 'qr', 'card', 'other') then
    raise exception 'Selecciona un metodo de pago valido.';
  end if;
  if not exists (select 1 from public.financial_accounts a where a.id = p_financial_account_id and a.is_active = true) then
    raise exception 'Financial account not found or inactive';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;
  if v_sale.status <> 'delivered_paid' then
    raise exception 'Sale income can be registered only after delivered_paid';
  end if;
  if coalesce(v_sale.total_collected, 0) <= 0 then
    raise exception 'Sale total_collected must be greater than zero';
  end if;

  insert into public.financial_movements (
    account_id, movement_type, direction, amount, description, source_type, source_id, occurred_at, created_by
  )
  values (
    p_financial_account_id,
    'sale_income',
    'income',
    v_sale.total_collected,
    'Cobro venta ' || p_sale_id::text,
    'sale',
    p_sale_id,
    coalesce(v_sale.delivered_at, now()),
    auth.uid()
  )
  on conflict (source_type, source_id, movement_type)
  where source_id is not null
    and movement_type in ('opening_balance', 'sale_income', 'commission_payment', 'expense', 'purchase_payment')
    and is_reversal = false
  do update set description = excluded.description
  returning id into v_movement_id;

  update public.sales
  set financial_account_id = p_financial_account_id,
      financial_income_movement_id = v_movement_id,
      payment_method = p_payment_method,
      updated_at = now()
  where id = p_sale_id;

  return v_movement_id;
end;
$$;

create or replace function public.admin_reverse_sale_income(p_sale_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can reverse sale income';
  end if;
  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Sale not found';
  end if;
  if v_sale.financial_income_movement_id is null then
    return null;
  end if;
  return public.admin_reverse_financial_movement(v_sale.financial_income_movement_id, 'Devolucion venta ' || p_sale_id::text);
end;
$$;

drop function if exists public.admin_transition_sale_status(uuid, text, text);
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
  v_reserved_states text[] := array['confirmed', 'preparing', 'out_for_delivery'];
begin
  if not public.is_admin() then
    raise exception 'Only active admins can update sales';
  end if;

  if v_new_status not in ('pending_contact','confirmed','preparing','out_for_delivery','delivered_paid','cancelled','failed_delivery','returned') then
    raise exception 'Invalid sale status';
  end if;

  select * into v_sale from public.sales s where s.id = p_sale_id for update;
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
    if p_financial_account_id is null or nullif(btrim(coalesce(p_payment_method, '')), '') is null then
      raise exception 'Para entregar y cobrar selecciona metodo de pago y cuenta financiera.';
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

  if v_new_status = 'delivered_paid' then
    perform public.admin_create_sale_income(p_sale_id, p_financial_account_id, p_payment_method);
    select * into v_sale from public.sales s where s.id = p_sale_id;
  elsif v_new_status = 'returned' then
    perform public.admin_reverse_sale_income(p_sale_id);
  end if;

  if nullif(btrim(coalesce(p_notes, '')), '') is not null then
    insert into public.sale_events (sale_id, actor_id, event_type, to_status, notes)
    values (p_sale_id, auth.uid(), 'status_note', v_new_status, nullif(btrim(p_notes), ''));
  end if;

  return query select v_sale.id, v_sale.status, v_sale.delivered_at, v_sale.paid_at;
end;
$$;

create or replace function public.admin_create_expense(
  p_category_id uuid,
  p_account_id uuid,
  p_description text,
  p_amount numeric,
  p_expense_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_movement_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can create expenses';
  end if;
  if not exists (select 1 from public.expense_categories c where c.id = p_category_id and c.is_active = true) then
    raise exception 'Expense category not found or inactive';
  end if;
  if not exists (select 1 from public.financial_accounts a where a.id = p_account_id and a.is_active = true) then
    raise exception 'Financial account not found or inactive';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  insert into public.expenses (category_id, account_id, description, amount, expense_date, notes, status, created_by)
  values (p_category_id, p_account_id, p_description, p_amount, coalesce(p_expense_date, (now() at time zone 'America/Asuncion')::date), p_notes, 'confirmed', auth.uid())
  returning id into v_expense_id;

  insert into public.financial_movements (account_id, movement_type, direction, amount, description, source_type, source_id, occurred_at, created_by)
  values (p_account_id, 'expense', 'expense', p_amount, p_description, 'expense', v_expense_id, coalesce(p_expense_date, (now() at time zone 'America/Asuncion')::date)::timestamp at time zone 'America/Asuncion', auth.uid())
  returning id into v_movement_id;

  update public.expenses set financial_movement_id = v_movement_id where id = v_expense_id;
  return v_expense_id;
end;
$$;

create or replace function public.admin_cancel_expense(p_expense_id uuid, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can cancel expenses';
  end if;
  select * into v_expense from public.expenses where id = p_expense_id for update;
  if v_expense.id is null then
    raise exception 'Expense not found';
  end if;
  if v_expense.status = 'cancelled' then
    return p_expense_id;
  end if;
  perform public.admin_reverse_financial_movement(v_expense.financial_movement_id, 'Anulacion gasto: ' || v_expense.description);
  update public.expenses
  set status = 'cancelled',
      notes = coalesce(nullif(btrim(p_notes), ''), notes),
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_at = now()
  where id = p_expense_id;
  return p_expense_id;
end;
$$;

create or replace function public.admin_save_purchase(
  p_purchase_id uuid default null,
  p_supplier_id uuid default null,
  p_purchase_date date default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing public.purchases%rowtype;
  v_item jsonb;
  v_product record;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can save purchases';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one purchase item is required';
  end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers s where s.id = p_supplier_id) then
    raise exception 'Supplier not found';
  end if;

  if p_purchase_id is not null then
    select * into v_existing from public.purchases where id = p_purchase_id for update;
    if v_existing.status <> 'draft' then
      raise exception 'Only draft purchases can be edited';
    end if;
    update public.purchases
    set supplier_id = p_supplier_id,
        purchase_date = coalesce(p_purchase_date, purchase_date),
        notes = nullif(btrim(p_notes), ''),
        updated_at = now()
    where id = p_purchase_id
    returning id into v_id;
    delete from public.purchase_items where purchase_id = v_id;
  else
    insert into public.purchases (supplier_id, purchase_date, notes, status, created_by)
    values (p_supplier_id, coalesce(p_purchase_date, (now() at time zone 'America/Asuncion')::date), nullif(btrim(p_notes), ''), 'draft', auth.uid())
    returning id into v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select p.id, p.name
    into v_product
    from public.products p
    where p.id = nullif(v_item->>'product_id', '')::uuid;
    if v_product.id is null then
      raise exception 'Purchase product not found';
    end if;
    insert into public.purchase_items (purchase_id, product_id, product_name_snapshot, quantity, unit_cost, line_total)
    values (
      v_id,
      v_product.id,
      v_product.name,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_cost')::numeric,
      (v_item->>'quantity')::integer * (v_item->>'unit_cost')::numeric
    );
  end loop;

  perform public.recalculate_purchase_total(v_id);
  return v_id;
end;
$$;

create or replace function public.admin_confirm_purchase(
  p_purchase_id uuid,
  p_register_payment boolean default false,
  p_financial_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
  v_item record;
  v_stock_before integer;
  v_location_id uuid;
  v_financial_movement_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can confirm purchases';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if v_purchase.id is null then
    raise exception 'Purchase not found';
  end if;
  if v_purchase.status = 'confirmed' then
    return p_purchase_id;
  end if;
  if v_purchase.status <> 'draft' then
    raise exception 'Only draft purchases can be confirmed';
  end if;
  if p_register_payment and p_financial_account_id is null then
    raise exception 'Selecciona una cuenta para registrar el pago de la compra.';
  end if;

  v_location_id := public.admin_default_inventory_location();

  for v_item in
    select * from public.purchase_items where purchase_id = p_purchase_id order by created_at asc, id asc
  loop
    select coalesce(stock_quantity, 0) into v_stock_before
    from public.products
    where id = v_item.product_id
    for update;

    insert into public.inventory_movements (
      product_id, location_id, movement_type, quantity_delta, stock_before, stock_after,
      unit_cost_snapshot, reason, notes, source_type, source_id, created_by
    )
    values (
      v_item.product_id, v_location_id, 'purchase_entry', v_item.quantity, v_stock_before, v_stock_before + v_item.quantity,
      v_item.unit_cost, 'Ingreso por compra', 'Movimiento automatico al confirmar compra', 'purchase_item', v_item.id, auth.uid()
    )
    on conflict (source_type, source_id, movement_type)
    where source_type = 'purchase_item' and source_id is not null and movement_type = 'purchase_entry'
    do nothing;

    update public.products
    set stock_quantity = coalesce(stock_quantity, 0) + v_item.quantity,
        updated_at = now()
    where id = v_item.product_id
      and not exists (
        select 1 from public.inventory_movements m
        where m.source_type = 'purchase_item'
          and m.source_id = v_item.id
          and m.movement_type = 'purchase_entry'
          and m.created_at < now() - interval '1 millisecond'
      );
  end loop;

  if p_register_payment then
    if not exists (select 1 from public.financial_accounts a where a.id = p_financial_account_id and a.is_active = true) then
      raise exception 'Financial account not found or inactive';
    end if;
    insert into public.financial_movements (
      account_id, movement_type, direction, amount, description, source_type, source_id, occurred_at, created_by
    )
    values (
      p_financial_account_id, 'purchase_payment', 'expense', v_purchase.total_amount,
      'Pago compra ' || p_purchase_id::text, 'purchase', p_purchase_id,
      v_purchase.purchase_date::timestamp at time zone 'America/Asuncion', auth.uid()
    )
    on conflict (source_type, source_id, movement_type)
    where source_id is not null
      and movement_type in ('opening_balance', 'sale_income', 'commission_payment', 'expense', 'purchase_payment')
      and is_reversal = false
    do update set description = excluded.description
    returning id into v_financial_movement_id;
  end if;

  update public.purchases
  set status = 'confirmed',
      confirmed_at = now(),
      financial_account_id = case when p_register_payment then p_financial_account_id else null end,
      financial_movement_id = v_financial_movement_id,
      payment_registered = p_register_payment,
      updated_at = now()
  where id = p_purchase_id;

  return p_purchase_id;
end;
$$;

create or replace function public.admin_cancel_purchase(p_purchase_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.purchases%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can cancel purchases';
  end if;
  select * into v_purchase from public.purchases where id = p_purchase_id for update;
  if v_purchase.id is null then
    raise exception 'Purchase not found';
  end if;
  if v_purchase.status = 'confirmed' then
    raise exception 'Esta compra ya ingreso al inventario. Corregi el stock mediante un ajuste.';
  end if;
  update public.purchases set status = 'cancelled', updated_at = now() where id = p_purchase_id;
  return p_purchase_id;
end;
$$;

create or replace function public.admin_open_cash_session(
  p_financial_account_id uuid,
  p_counted_balance numeric,
  p_register_difference boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected numeric(14,2);
  v_id uuid;
  v_difference numeric(14,2);
begin
  if not public.is_admin() then
    raise exception 'Only active admins can open cash sessions';
  end if;
  if not exists (select 1 from public.financial_accounts a where a.id = p_financial_account_id and a.is_cash_account = true and a.is_active = true) then
    raise exception 'Cash account not found or inactive';
  end if;
  select current_balance into v_expected from public.get_financial_account_balances() where id = p_financial_account_id;
  v_difference := coalesce(p_counted_balance, 0) - coalesce(v_expected, 0);
  insert into public.cash_sessions (
    financial_account_id, opening_expected_balance, opening_counted_balance, opening_difference, status, opened_by, notes
  )
  values (p_financial_account_id, v_expected, coalesce(p_counted_balance, 0), v_difference, 'open', auth.uid(), p_notes)
  returning id into v_id;
  if p_register_difference and v_difference <> 0 then
    perform public.admin_create_financial_movement(
      p_financial_account_id,
      case when v_difference > 0 then 'income' else 'expense' end,
      abs(v_difference),
      'Ajuste apertura de caja',
      'cash_adjustment',
      now(),
      v_id::text
    );
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_close_cash_session(
  p_session_id uuid,
  p_counted_balance numeric,
  p_register_difference boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_expected numeric(14,2);
  v_difference numeric(14,2);
begin
  if not public.is_admin() then
    raise exception 'Only active admins can close cash sessions';
  end if;
  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if v_session.id is null or v_session.status <> 'open' then
    raise exception 'Open cash session not found';
  end if;
  select current_balance into v_expected from public.get_financial_account_balances() where id = v_session.financial_account_id;
  v_difference := coalesce(p_counted_balance, 0) - coalesce(v_expected, 0);
  update public.cash_sessions
  set status = 'closed',
      closed_at = now(),
      closing_expected_balance = v_expected,
      closing_counted_balance = coalesce(p_counted_balance, 0),
      closing_difference = v_difference,
      closed_by = auth.uid(),
      notes = coalesce(nullif(btrim(p_notes), ''), notes)
  where id = p_session_id;
  if p_register_difference and v_difference <> 0 then
    perform public.admin_create_financial_movement(
      v_session.financial_account_id,
      case when v_difference > 0 then 'income' else 'expense' end,
      abs(v_difference),
      'Ajuste cierre de caja',
      'cash_adjustment',
      now(),
      p_session_id::text
    );
  end if;
  return p_session_id;
end;
$$;

drop function if exists public.mark_commission_payment_paid(uuid, date, text, text, text, text);
create or replace function public.mark_commission_payment_paid(
  p_payment_id uuid,
  p_payment_date date,
  p_payment_method text default null,
  p_voucher_url text default null,
  p_voucher_number text default null,
  p_notes text default null,
  p_financial_account_id uuid default null
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
  v_movement_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can confirm commission payments';
  end if;
  if p_payment_date is null then
    raise exception 'payment_date is required';
  end if;

  select * into v_payment from public.commission_payments p where p.id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'Commission payment not found';
  end if;
  if v_payment.status = 'paid' then
    return p_payment_id;
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Only pending commission payments can be marked as paid';
  end if;
  if p_financial_account_id is null then
    raise exception 'Selecciona la cuenta desde la que se pago la comision.';
  end if;
  if not exists (select 1 from public.financial_accounts a where a.id = p_financial_account_id and a.is_active = true) then
    raise exception 'Financial account not found or inactive';
  end if;

  select count(*) into v_item_count from public.commission_payment_items item where item.payment_id = p_payment_id;
  if v_item_count = 0 then
    raise exception 'Cannot pay a commission payment without items';
  end if;

  insert into public.financial_movements (
    account_id, movement_type, direction, amount, description, source_type, source_id, occurred_at, created_by
  )
  values (
    p_financial_account_id, 'commission_payment', 'expense', v_payment.net_paid,
    'Pago comision ' || p_payment_id::text, 'commission_payment', p_payment_id,
    p_payment_date::timestamp at time zone 'America/Asuncion', auth.uid()
  )
  on conflict (source_type, source_id, movement_type)
  where source_id is not null
    and movement_type in ('opening_balance', 'sale_income', 'commission_payment', 'expense', 'purchase_payment')
    and is_reversal = false
  do update set description = excluded.description
  returning id into v_movement_id;

  update public.commission_payments p
  set status = 'paid',
      payment_date = p_payment_date,
      payment_method = nullif(btrim(p_payment_method), ''),
      voucher_url = nullif(btrim(p_voucher_url), ''),
      voucher_number = nullif(btrim(p_voucher_number), ''),
      notes = coalesce(nullif(btrim(p_notes), ''), p.notes),
      financial_account_id = p_financial_account_id,
      financial_movement_id = v_movement_id,
      updated_at = now()
  where p.id = p_payment_id;

  update public.sales s
  set commission_paid = true,
      commission_paid_at = p_payment_date::timestamp at time zone 'America/Asuncion',
      commission_payment_id = p_payment_id,
      updated_at = now()
  where s.id in (select item.sale_id from public.commission_payment_items item where item.payment_id = p_payment_id)
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

drop function if exists public.admin_create_commission_payments_bulk(uuid, uuid[], date, text, text, text, text);
create or replace function public.admin_create_commission_payments_bulk(
  p_batch_id uuid,
  p_reseller_ids uuid[],
  p_payment_date date,
  p_payment_method text default null,
  p_voucher_url text default null,
  p_voucher_number text default null,
  p_notes text default null,
  p_financial_account_id uuid default null
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
  if p_financial_account_id is null then
    raise exception 'Selecciona una cuenta financiera para pagar comisiones.';
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
      v_payment_id := public.create_commission_payment(p_batch_id, v_reseller_id, v_sale_ids, 0, 0, p_notes);
      perform public.mark_commission_payment_paid(v_payment_id, p_payment_date, p_payment_method, p_voucher_url, p_voucher_number, p_notes, p_financial_account_id);
      payment_id := v_payment_id;
      reseller_id := v_reseller_id;
      return next;
    end if;
  end loop;
end;
$$;

create or replace function public.get_admin_finance_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date := date_trunc('month', now() at time zone 'America/Asuncion')::date;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only active admins can view finance dashboard';
  end if;

  select jsonb_build_object(
    'money_current', (select coalesce(sum(current_balance), 0) from public.get_financial_account_balances() where is_active),
    'month_income', (select coalesce(sum(amount), 0) from public.financial_movements where direction = 'income' and movement_type not in ('transfer_in', 'opening_balance') and (occurred_at at time zone 'America/Asuncion')::date >= v_start),
    'month_expense', (select coalesce(sum(amount), 0) from public.financial_movements where direction = 'expense' and movement_type <> 'transfer_out' and (occurred_at at time zone 'America/Asuncion')::date >= v_start),
    'month_expenses', (select coalesce(sum(amount), 0) from public.expenses where status = 'confirmed' and expense_date >= v_start),
    'month_operating_profit', (select coalesce(sum(camaraza_net_profit), 0) from public.sales where status = 'delivered_paid' and (delivered_at at time zone 'America/Asuncion')::date >= v_start),
    'month_net_profit', (select coalesce(sum(camaraza_net_profit), 0) from public.sales where status = 'delivered_paid' and (delivered_at at time zone 'America/Asuncion')::date >= v_start) - (select coalesce(sum(amount), 0) from public.expenses where status = 'confirmed' and expense_date >= v_start),
    'inventory_value', (select coalesce(sum(coalesce(p.stock_quantity, 0) * coalesce(p.cost_price, 0)), 0) from public.products p join public.product_admin_details d on d.product_id = p.id where coalesce(d.track_inventory, true) = true),
    'pending_commissions', (select coalesce(sum(reseller_commission), 0) from public.sales where sale_type = 'reseller' and status = 'delivered_paid' and commission_paid = false)
  ) into result;

  return result;
end;
$$;

drop trigger if exists financial_accounts_prepare_row on public.financial_accounts;
create trigger financial_accounts_prepare_row
before insert or update on public.financial_accounts
for each row execute function public.prepare_financial_account_row();

drop trigger if exists financial_movements_prepare_row on public.financial_movements;
create trigger financial_movements_prepare_row
before insert or update on public.financial_movements
for each row execute function public.prepare_financial_movement_row();

drop trigger if exists expense_categories_prepare_row on public.expense_categories;
create trigger expense_categories_prepare_row
before insert or update on public.expense_categories
for each row execute function public.prepare_expense_category_row();

drop trigger if exists purchase_items_prepare_row on public.purchase_items;
create trigger purchase_items_prepare_row
before insert or update on public.purchase_items
for each row execute function public.prepare_purchase_item_row();

drop trigger if exists purchase_items_refresh_total on public.purchase_items;
create trigger purchase_items_refresh_total
after insert or update or delete on public.purchase_items
for each row execute function public.refresh_purchase_total_from_item();

-- RLS: admin only for every finance/purchase table.
drop policy if exists "Admins can read financial accounts" on public.financial_accounts;
create policy "Admins can read financial accounts" on public.financial_accounts for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert financial accounts" on public.financial_accounts;
create policy "Admins can insert financial accounts" on public.financial_accounts for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update financial accounts" on public.financial_accounts;
create policy "Admins can update financial accounts" on public.financial_accounts for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can read financial movements" on public.financial_movements;
create policy "Admins can read financial movements" on public.financial_movements for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert financial movements" on public.financial_movements;

drop policy if exists "Admins can read expense categories" on public.expense_categories;
create policy "Admins can read expense categories" on public.expense_categories for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert expense categories" on public.expense_categories;
create policy "Admins can insert expense categories" on public.expense_categories for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update expense categories" on public.expense_categories;
create policy "Admins can update expense categories" on public.expense_categories for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can read expenses" on public.expenses;
create policy "Admins can read expenses" on public.expenses for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert expenses" on public.expenses;
drop policy if exists "Admins can update expenses" on public.expenses;

drop policy if exists "Admins can read cash sessions" on public.cash_sessions;
create policy "Admins can read cash sessions" on public.cash_sessions for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert cash sessions" on public.cash_sessions;
drop policy if exists "Admins can update cash sessions" on public.cash_sessions;

drop policy if exists "Admins can read purchases" on public.purchases;
create policy "Admins can read purchases" on public.purchases for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert purchases" on public.purchases;
drop policy if exists "Admins can update purchases" on public.purchases;

drop policy if exists "Admins can read purchase items" on public.purchase_items;
create policy "Admins can read purchase items" on public.purchase_items for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert purchase items" on public.purchase_items;
drop policy if exists "Admins can update purchase items" on public.purchase_items;

alter function public.get_financial_account_balances() owner to postgres;
alter function public.admin_save_financial_account(uuid, text, text, text, text, text, numeric, boolean, boolean, integer) owner to postgres;
alter function public.admin_create_financial_movement(uuid, text, numeric, text, text, timestamptz, text) owner to postgres;
alter function public.admin_create_account_transfer(uuid, uuid, numeric, text, timestamptz) owner to postgres;
alter function public.admin_reverse_financial_movement(uuid, text) owner to postgres;
alter function public.admin_create_sale_income(uuid, uuid, text) owner to postgres;
alter function public.admin_reverse_sale_income(uuid) owner to postgres;
alter function public.admin_transition_sale_status(uuid, text, text, uuid, text) owner to postgres;
alter function public.admin_create_expense(uuid, uuid, text, numeric, date, text) owner to postgres;
alter function public.admin_cancel_expense(uuid, text) owner to postgres;
alter function public.admin_save_purchase(uuid, uuid, date, text, jsonb) owner to postgres;
alter function public.admin_confirm_purchase(uuid, boolean, uuid) owner to postgres;
alter function public.admin_cancel_purchase(uuid) owner to postgres;
alter function public.admin_open_cash_session(uuid, numeric, boolean, text) owner to postgres;
alter function public.admin_close_cash_session(uuid, numeric, boolean, text) owner to postgres;
alter function public.mark_commission_payment_paid(uuid, date, text, text, text, text, uuid) owner to postgres;
alter function public.admin_create_commission_payments_bulk(uuid, uuid[], date, text, text, text, text, uuid) owner to postgres;
alter function public.get_admin_finance_dashboard() owner to postgres;

revoke all on function public.get_financial_account_balances() from public;
revoke all on function public.admin_save_financial_account(uuid, text, text, text, text, text, numeric, boolean, boolean, integer) from public;
revoke all on function public.admin_create_financial_movement(uuid, text, numeric, text, text, timestamptz, text) from public;
revoke all on function public.admin_create_account_transfer(uuid, uuid, numeric, text, timestamptz) from public;
revoke all on function public.admin_reverse_financial_movement(uuid, text) from public;
revoke all on function public.admin_create_sale_income(uuid, uuid, text) from public;
revoke all on function public.admin_reverse_sale_income(uuid) from public;
revoke all on function public.admin_transition_sale_status(uuid, text, text, uuid, text) from public;
revoke all on function public.admin_create_expense(uuid, uuid, text, numeric, date, text) from public;
revoke all on function public.admin_cancel_expense(uuid, text) from public;
revoke all on function public.admin_save_purchase(uuid, uuid, date, text, jsonb) from public;
revoke all on function public.admin_confirm_purchase(uuid, boolean, uuid) from public;
revoke all on function public.admin_cancel_purchase(uuid) from public;
revoke all on function public.admin_open_cash_session(uuid, numeric, boolean, text) from public;
revoke all on function public.admin_close_cash_session(uuid, numeric, boolean, text) from public;
revoke all on function public.mark_commission_payment_paid(uuid, date, text, text, text, text, uuid) from public;
revoke all on function public.admin_create_commission_payments_bulk(uuid, uuid[], date, text, text, text, text, uuid) from public;
revoke all on function public.get_admin_finance_dashboard() from public;

grant execute on function public.get_financial_account_balances() to authenticated;
grant execute on function public.admin_save_financial_account(uuid, text, text, text, text, text, numeric, boolean, boolean, integer) to authenticated;
grant execute on function public.admin_create_financial_movement(uuid, text, numeric, text, text, timestamptz, text) to authenticated;
grant execute on function public.admin_create_account_transfer(uuid, uuid, numeric, text, timestamptz) to authenticated;
grant execute on function public.admin_transition_sale_status(uuid, text, text, uuid, text) to authenticated;
grant execute on function public.admin_create_expense(uuid, uuid, text, numeric, date, text) to authenticated;
grant execute on function public.admin_cancel_expense(uuid, text) to authenticated;
grant execute on function public.admin_save_purchase(uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function public.admin_confirm_purchase(uuid, boolean, uuid) to authenticated;
grant execute on function public.admin_cancel_purchase(uuid) to authenticated;
grant execute on function public.admin_open_cash_session(uuid, numeric, boolean, text) to authenticated;
grant execute on function public.admin_close_cash_session(uuid, numeric, boolean, text) to authenticated;
grant execute on function public.mark_commission_payment_paid(uuid, date, text, text, text, text, uuid) to authenticated;
grant execute on function public.admin_create_commission_payments_bulk(uuid, uuid[], date, text, text, text, text, uuid) to authenticated;
grant execute on function public.get_admin_finance_dashboard() to authenticated;

notify pgrst, 'reload schema';

commit;
