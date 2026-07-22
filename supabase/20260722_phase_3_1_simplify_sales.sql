-- Camaraza Store Re-venta - Fase 3.1: simplificacion y correccion del modulo de ventas.
-- Ejecutar manualmente despues de Fase 3 y antes de usar el formulario simplificado.
-- No borra columnas ni recalcula ventas historicas.

begin;

alter table public.sales
  add column if not exists fulfillment_type text,
  add column if not exists payment_timing text;

alter table public.sales drop constraint if exists sales_fulfillment_type_check;
alter table public.sales
  add constraint sales_fulfillment_type_check
  check (fulfillment_type is null or fulfillment_type in ('delivery', 'transportadora'))
  not valid;

alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales
  add constraint sales_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'transfer', 'card'))
  not valid;

alter table public.sales drop constraint if exists sales_payment_timing_check;
alter table public.sales
  add constraint sales_payment_timing_check
  check (payment_timing is null or payment_timing in ('on_delivery', 'prepaid'))
  not valid;

create or replace function public.prepare_sale_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reseller_ok boolean;
  product_row record;
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

  if new.product_id is not null then
    select p.name, p.model, p.cost_price, p.suggested_price
    into product_row
    from public.products p
    where p.id = new.product_id;

    if product_row.name is null then
      raise exception 'Sale product_id must reference an existing product';
    end if;

    new.product_name_snapshot := product_row.name;
    new.product_model_snapshot := product_row.model;
    new.product_cost := greatest(coalesce(product_row.cost_price, 0), 0);
    if coalesce(new.product_sale_price, 0) = 0 then
      new.product_sale_price := greatest(coalesce(product_row.suggested_price, 0), 0);
    end if;
  end if;

  new.product_name_snapshot := nullif(btrim(new.product_name_snapshot), '');
  if new.product_name_snapshot is null then
    raise exception 'Sale product_name_snapshot is required';
  end if;

  new.product_sale_price := greatest(coalesce(new.product_sale_price, 0), 0);
  new.product_cost := greatest(coalesce(new.product_cost, 0), 0);
  new.delivery_charged := greatest(coalesce(new.delivery_charged, 0), 0);
  new.delivery_cost := 0;
  new.reseller_commission := greatest(coalesce(new.reseller_commission, 0), 0);
  new.other_costs := 0;
  new.amount_received := greatest(coalesce(new.amount_received, 0), 0);

  new.fulfillment_type := coalesce(nullif(btrim(new.fulfillment_type), ''), 'delivery');
  new.payment_method := nullif(btrim(new.payment_method), '');
  new.payment_timing := coalesce(nullif(btrim(new.payment_timing), ''), 'on_delivery');
  new.delivery_schedule := nullif(btrim(new.delivery_schedule), '');

  new.total_collected := new.product_sale_price + new.delivery_charged;
  new.camaraza_net_profit :=
    new.product_sale_price
    - new.product_cost
    - new.reseller_commission;

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

notify pgrst, 'reload schema';

commit;
