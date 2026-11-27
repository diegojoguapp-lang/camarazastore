-- Opt-in Staging QA only: commission lifecycle with official fictitious fixtures.
-- Operator MUST independently verify the authorized Staging project identity
-- before executing this file through an administrative SQL connection.
-- Resolves existing dummy fixture names dynamically; contains no credentials,
-- project identifiers or private UUIDs. Never run against production.
-- Effective application role is authenticated; JWT claims are SIMULATED SQL
-- identities. These checks do not constitute real Auth, API or browser tests.
-- Disposable bank metadata is seeded by the SQL operator inside the transaction;
-- that fixture provisioning does not validate application bank-form permissions.
-- All commercial fixture writes roll back. PostgreSQL sequences are
-- nontransactional and may advance despite ROLLBACK.
-- Execute the WHOLE file in one connection; inspect results and independently
-- verify baseline afterward. Assertion/permission errors abort the transaction.

begin;
set local statement_timeout='30s';
do $$
declare v_admin uuid;
begin
  if (select count(*) from public.profiles where role='admin' and is_active)<>1 then raise exception 'QA admin ambiguous'; end if;
  select id into v_admin from public.profiles where role='admin' and is_active;
  if (select count(*) from public.products where name='Drone QA' and stock_quantity=10 and reserved_stock_quantity=0)<>1
     or (select count(*) from public.profiles where full_name in ('Revendedor QA A','Revendedor QA B') and role='reseller' and is_active)<>2
     or exists(select 1 from public.sales) or exists(select 1 from public.bank_accounts) or exists(select 1 from public.financial_movements)
     or exists(select 1 from public.commission_batches) then raise exception 'QA baseline changed'; end if;
  insert into public.bank_accounts(reseller_id,bank_name,bank_alias,bank_holder,bank_document,is_primary,created_by)
  select id,'QA_FICTICIO_COMISION_C02',case when full_name='Revendedor QA A' then 'QA_NO_PAGAR_A' else 'QA_NO_PAGAR_B' end,full_name,'FICTICIO',true,v_admin from public.profiles where full_name in ('Revendedor QA A','Revendedor QA B') and role='reseller' and is_active;
  perform set_config('qa.admin',v_admin::text,true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$
declare
  v_admin uuid:=current_setting('qa.admin')::uuid; v_a uuid; v_b uuid; v_product uuid; v_cash uuid;
  v_sale_a uuid; v_sale_b uuid; v_batch uuid; v_pay_a uuid; v_pay_b uuid; v_result jsonb; v_balance jsonb;
  v_results jsonb:='[]'::jsonb; v_denied boolean; v_retry uuid; v_today date:=(now() at time zone 'America/Asuncion')::date;
begin
  if extract(isodow from v_today) not between 1 and 6 then raise exception 'Requires eligible Mon-Sat test date'; end if;
  select id into strict v_a from public.profiles where full_name='Revendedor QA A' and role='reseller' and is_active;
  select id into strict v_b from public.profiles where full_name='Revendedor QA B' and role='reseller' and is_active;
  select id into strict v_product from public.products where name='Drone QA';
  select id into strict v_cash from public.financial_accounts where name='Caja ficticia QA' and is_active and account_type='cash';
  v_sale_a:=public.admin_save_sale_v2(null,jsonb_build_object('sale_type','reseller','reseller_id',v_a,'status','confirmed',
    'customer_name','Cliente Ficticio Comision A','payment_method','cash','financial_account_id',v_cash,'fulfillment_type','pickup','payment_timing','on_delivery',
    'items',jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1,'unit_sale_price',150000)),'admin_notes','QA_FICTICIO_COMISION_C02'));
  v_sale_b:=public.admin_save_sale_v2(null,jsonb_build_object('sale_type','reseller','reseller_id',v_b,'status','confirmed',
    'customer_name','Cliente Ficticio Comision B','payment_method','cash','financial_account_id',v_cash,'fulfillment_type','pickup','payment_timing','on_delivery',
    'items',jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',2,'unit_sale_price',170000)),'admin_notes','QA_FICTICIO_COMISION_C02'));
  if not exists(select 1 from public.sales where id=v_sale_a and total_collected=150000 and reseller_commission=50000)
     or not exists(select 1 from public.sales where id=v_sale_b and total_collected=340000 and reseller_commission=140000)
     or not exists(select 1 from public.products where id=v_product and stock_quantity=10 and reserved_stock_quantity=3 and available_stock_quantity=7)
  then raise exception 'FAIL creation/calculation/reservation'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','commission_calculation','expected','A50000 B140000; total490000; stock10 reserved3 available7','obtained','matches','status','PASS SQL'));
  v_denied:=false;
  begin
    perform public.admin_save_sale_v2(null,jsonb_build_object('sale_type','reseller','reseller_id',v_a,'status','confirmed',
      'customer_name','Cliente Ficticio Precio Invalido','payment_method','cash','financial_account_id',v_cash,'fulfillment_type','pickup',
      'items',jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1,'unit_sale_price',99999))));
  exception when raise_exception then
    if sqlerrm like 'El precio de venta no puede ser menor al precio mayorista%' then v_denied:=true; else raise; end if;
  end;
  if not v_denied or (select count(*) from public.sales)<>2 then raise exception 'FAIL below-wholesale rejection'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','below_wholesale','expected','reject without extra sale','obtained','rejected; sales2','status','PASS SQL'));
  perform public.admin_operate_sale_v2(v_sale_a,'confirmed','out_for_delivery',null);
  perform public.admin_operate_sale_v2(v_sale_b,'confirmed','out_for_delivery',null);
  perform public.admin_operate_sale_v2(v_sale_a,'out_for_delivery','delivered_paid',null);
  perform public.admin_operate_sale_v2(v_sale_b,'out_for_delivery','delivered_paid',null);
  perform public.admin_operate_sale_v2(v_sale_a,'out_for_delivery','delivered_paid',null);
  if (select count(*) from public.financial_movements where movement_type='sale_income')<>2
     or (select sum(amount) from public.financial_movements where movement_type='sale_income')<>490000
     or not exists(select 1 from public.products where id=v_product and stock_quantity=7 and reserved_stock_quantity=0)
  then raise exception 'FAIL delivery/retry'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','delivery_retry','expected','stock7 reserved0 incomes2 sum490000','obtained','matches','status','PASS SQL'));
  perform set_config('request.jwt.claim.sub',v_a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
  v_result:=public.get_my_operation_sales_v2();
  if (v_result->>'total')::integer<>1 or v_result->'rows'->0->>'id'<>v_sale_a::text then raise exception 'FAIL A populated sales isolation'; end if;
  v_result:=public.get_commission_sales_v2(v_a,'available',0);
  v_balance:=public.get_my_commission_balances_v2();
  if jsonb_array_length(v_result)<>1 or v_result->0->>'id'<>v_sale_a::text or (v_balance->>'available')::numeric<>50000 then raise exception 'FAIL A commission'; end if;
  v_denied:=false;
  begin perform public.get_commission_sales_v2(v_b,'available',0);
  exception when raise_exception then if sqlerrm='Acceso denegado.' then v_denied:=true; else raise; end if; end;
  if not v_denied then raise exception 'FAIL A foreign ID'; end if;
  perform set_config('request.jwt.claim.sub',v_b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
  v_result:=public.get_my_operation_sales_v2();
  if (v_result->>'total')::integer<>1 or v_result->'rows'->0->>'id'<>v_sale_b::text then raise exception 'FAIL B populated sales isolation'; end if;
  v_result:=public.get_commission_sales_v2(v_b,'available',0);
  v_balance:=public.get_my_commission_balances_v2();
  if jsonb_array_length(v_result)<>1 or v_result->0->>'id'<>v_sale_b::text or (v_balance->>'available')::numeric<>140000 then raise exception 'FAIL B commission'; end if;
  v_denied:=false;
  begin perform public.get_commission_sales_v2(v_a,'available',0);
  exception when raise_exception then if sqlerrm='Acceso denegado.' then v_denied:=true; else raise; end if; end;
  if not v_denied then raise exception 'FAIL B foreign ID'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','populated_reseller_isolation','expected','each sees exactly its own sale and amount; foreign ID rejected both ways','obtained','A1/50000 B1/140000; both denials','status','PASS SQL simulated identities'));
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  perform public.admin_ensure_commission_batches();
  select id into strict v_batch from public.commission_batches where v_today between period_start and period_end;
  v_denied:=false;
  begin perform public.create_commission_payment(v_batch,v_a,array[v_sale_b],0,0,'QA_FICTICIO_COMISION_C02');
  exception when raise_exception then if sqlerrm='One or more sales are not eligible for this commission payment' then v_denied:=true; else raise; end if; end;
  if not v_denied or exists(select 1 from public.commission_payments) then raise exception 'FAIL mixed-reseller settlement rejected'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','foreign_sale_settlement','expected','reject B sale in A payment','obtained','rejected; payments0','status','PASS SQL'));
  v_pay_a:=public.create_commission_payment(v_batch,v_a,array[v_sale_a],0,0,'QA_FICTICIO_COMISION_C02');
  v_pay_b:=public.create_commission_payment(v_batch,v_b,array[v_sale_b],0,0,'QA_FICTICIO_COMISION_C02');
  if not exists(select 1 from public.commission_payments where id=v_pay_a and status='pending' and gross_commission=50000 and net_paid=50000)
     or not exists(select 1 from public.commission_payments where id=v_pay_b and status='pending' and gross_commission=140000 and net_paid=140000)
  then raise exception 'FAIL pending settlement'; end if;
  perform set_config('request.jwt.claim.sub',v_a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
  v_balance:=public.get_my_commission_balances_v2();
  if (v_balance->>'available')::numeric<>0 or (v_balance->>'liquidating')::numeric<>50000 then raise exception 'FAIL pending balance'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','pending_settlement','expected','pending payments50000/140000; A available0 liquidating50000','obtained','matches','status','PASS SQL'));
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  perform public.mark_commission_payment_paid(v_pay_a,v_today,'cash',null,null,'QA_FICTICIO_COMISION_C02',v_cash);
  perform public.mark_commission_payment_paid(v_pay_b,v_today,'cash',null,null,'QA_FICTICIO_COMISION_C02',v_cash);
  v_retry:=public.mark_commission_payment_paid(v_pay_a,v_today,'cash',null,null,'QA_FICTICIO_COMISION_C02',v_cash);
  perform public.mark_commission_payment_paid(v_pay_b,v_today,'cash',null,null,'QA_FICTICIO_COMISION_C02',v_cash);
  if v_retry<>v_pay_a or (select count(*) from public.financial_movements where movement_type='commission_payment')<>2
     or (select sum(amount) from public.financial_movements where movement_type='commission_payment')<>190000
     or (select sum(case when direction='income' then amount else -amount end) from public.financial_movements)<>300000
     or (select count(*) from public.sales where commission_paid)<>2
  then raise exception 'FAIL paid settlement/retry'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','paid_settlement_retry','expected','expenses2 sum190000 net_cash300000; sales_paid2; same payment IDs','obtained','matches','status','PASS SQL'));
  perform set_config('request.jwt.claim.sub',v_a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a,'role','authenticated')::text,true);
  v_result:=public.get_my_payment_receipts_v2();
  v_balance:=public.get_my_commission_balances_v2();
  if jsonb_array_length(v_result)<>1 or v_result->0->>'id'<>v_pay_a::text or (v_balance->>'paid')::numeric<>50000
     or (v_balance->>'available')::numeric<>0 or (v_balance->>'liquidating')::numeric<>0
     or public.get_my_payment_receipts_v2(v_pay_b,0)<>'[]'::jsonb then raise exception 'FAIL A paid receipt isolation'; end if;
  perform set_config('request.jwt.claim.sub',v_b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b,'role','authenticated')::text,true);
  v_result:=public.get_my_payment_receipts_v2();
  v_balance:=public.get_my_commission_balances_v2();
  if jsonb_array_length(v_result)<>1 or v_result->0->>'id'<>v_pay_b::text or (v_balance->>'paid')::numeric<>140000
     or (v_balance->>'available')::numeric<>0 or (v_balance->>'liquidating')::numeric<>0
     or public.get_my_payment_receipts_v2(v_pay_a,0)<>'[]'::jsonb then raise exception 'FAIL B paid receipt isolation'; end if;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('test','paid_receipt_isolation','expected','own receipt1 each; foreign receipt0; paid A50000/B140000 available0 liquidating0','obtained','matches','status','PASS SQL simulated identities'));
  perform set_config('qa.commission_results',v_results::text,true);
end $$;
select current_setting('qa.commission_results')::jsonb as results;
rollback;
