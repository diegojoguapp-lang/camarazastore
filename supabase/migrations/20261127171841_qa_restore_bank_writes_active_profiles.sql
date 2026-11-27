-- Restore the bank form operations intended by the existing API, after
-- requiring an active owning reseller on every own-row policy.
drop policy if exists "Resellers can read own bank account" on public.bank_accounts;
create policy "Resellers can read own bank account" on public.bank_accounts
for select to authenticated
using (reseller_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'reseller' and p.is_active
));
drop policy if exists "Resellers can insert own bank account" on public.bank_accounts;
create policy "Resellers can insert own bank account" on public.bank_accounts
for insert to authenticated
with check (reseller_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'reseller' and p.is_active
));
drop policy if exists "Resellers can update own bank account" on public.bank_accounts;
create policy "Resellers can update own bank account" on public.bank_accounts
for update to authenticated
using (reseller_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'reseller' and p.is_active
))
with check (reseller_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'reseller' and p.is_active
));
grant insert, update on public.bank_accounts to authenticated;
notify pgrst, 'reload schema';
