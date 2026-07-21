-- Camaraza Store Re-venta - Fase 2: cuentas de revendedores.
-- Ejecutar manualmente despues de supabase/20260720_phase_1_profiles_roles.sql.
-- No crea ventas, comisiones, pagos, clientes, entregas, inventario ni finanzas.

begin;

alter table public.profiles
  add column if not exists email text;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create sequence if not exists public.reseller_code_seq
  as integer
  increment by 1
  minvalue 1
  start with 1
  owned by none;

do $$
declare
  max_code integer;
begin
  select max((regexp_match(reseller_code, '^REV-([0-9]+)$'))[1]::integer)
  into max_code
  from public.profiles
  where reseller_code ~ '^REV-[0-9]+$';

  if max_code is not null then
    perform setval('public.reseller_code_seq', greatest(max_code, 1), true);
  end if;
end $$;

create or replace function public.next_reseller_code()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'REV-' || lpad(nextval('public.reseller_code_seq')::text, 4, '0')
$$;

alter sequence public.reseller_code_seq owner to postgres;
alter function public.next_reseller_code() owner to postgres;

revoke all on sequence public.reseller_code_seq from public;
revoke all on sequence public.reseller_code_seq from anon;
revoke all on sequence public.reseller_code_seq from authenticated;
grant usage, select on sequence public.reseller_code_seq to service_role;

revoke all on function public.next_reseller_code() from public;
revoke all on function public.next_reseller_code() from anon;
revoke all on function public.next_reseller_code() from authenticated;
grant execute on function public.next_reseller_code() to service_role;

notify pgrst, 'reload schema';

commit;

-- Rollback manual:
-- begin;
-- drop function if exists public.next_reseller_code();
-- drop sequence if exists public.reseller_code_seq;
-- drop index if exists public.profiles_email_unique_idx;
-- alter table public.profiles drop column if exists email;
-- notify pgrst, 'reload schema';
-- commit;
