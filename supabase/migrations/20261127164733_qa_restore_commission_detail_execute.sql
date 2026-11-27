-- QA: reconcile the exact public wrapper permission already required by
-- 20260908_daily_operations_reseller_finance_v2.sql.
-- Internal commission helpers remain inaccessible to client roles.
grant execute on function public.get_commission_sales_v2(uuid,text,integer) to authenticated;
notify pgrst, 'reload schema';
