import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { businessDate, shiftDate, operationRange, changeDue, customerWhatsApp, orderCode } from '../src/lib/operationDates.js'
import { getCurrentCommissionPeriod } from '../src/lib/dateUtils.js'

const sql = readFileSync(new URL('../supabase/20260908_daily_operations_reseller_finance_v2.sql', import.meta.url), 'utf8')
const section = (name) => sql.split(`create or replace function public.${name}(`)[1]?.split('$$;')[0]

function normalizeLegacyPayment(sale) {
  if (sale.payment_method == null) return { ...sale }
  const mappings = { cash: 'cash', efectivo: 'cash', transfer: 'transfer', transferencia: 'transfer', card: 'card' }
  const normalized = mappings[String(sale.payment_method).trim().toLowerCase()]
  if (!normalized) throw new Error(`payment_method desconocido: ${sale.payment_method}`)
  return { ...sale, payment_method: normalized }
}

test('fecha operativa usa Asuncion, no la fecha UTC', () => {
  assert.equal(businessDate('2026-09-08T02:59:59Z'), '2026-09-07')
  assert.equal(businessDate('2026-09-08T03:00:00Z'), '2026-09-08')
})
test('rangos operativos abarcan domingo sin cambiar el periodo de comision', () => {
  assert.deepEqual(operationRange('this_week', '2026-09-13'), { from: '2026-09-07', to: '2026-09-13' })
  assert.deepEqual(operationRange('last_week', '2026-09-13'), { from: '2026-08-31', to: '2026-09-06' })
  assert.deepEqual(operationRange('all'), { from: '', to: '' })
})
test('cambio de mes y de ano', () => {
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(shiftDate('2026-09-01', -1), '2026-08-31')
  assert.deepEqual(operationRange('this_week', '2027-01-01'), { from: '2026-12-28', to: '2027-01-03' })
  assert.deepEqual(operationRange('month', '2026-09-08'), { from: '2026-09-01', to: '2026-09-30' })
})
test('lunes incluido, sabado incluido, domingo excluido en comision', () => {
  const { start, endExclusive } = getCurrentCommissionPeriod(new Date('2026-09-09T12:00Z'))
  const inPeriod = (date) => new Date(date) >= start && new Date(date) < endExclusive
  assert.equal(inPeriod('2026-09-07T03:00:00Z'), true)
  assert.equal(inPeriod('2026-09-13T02:59:59.999Z'), true)
  assert.equal(inPeriod('2026-09-13T03:00:00Z'), false)
  assert.equal(businessDate(new Date(endExclusive.getTime() - 1)), '2026-09-12')
})
test('vuelto: opcional, exacto, positivo; rechaza insuficiente y NaN', () => {
  assert.equal(changeDue(120000, null), null)
  assert.equal(changeDue(120000, 120000), 0)
  assert.equal(changeDue(120000, 150000), 30000)
  assert.throws(() => changeDue(120000, 100000))
  assert.throws(() => changeDue(120000, 'invalido'))
})
test('WhatsApp PY sin mensaje y sin URL para datos invalidos', () => {
  assert.equal(customerWhatsApp('0981 123 456'), 'https://wa.me/595981123456')
  assert.equal(customerWhatsApp('+595 981 123456'), 'https://wa.me/595981123456')
  assert.equal(customerWhatsApp('981123456'), 'https://wa.me/595981123456')
  assert.equal(customerWhatsApp('123'), null)
  assert.equal(customerWhatsApp(null), null)
  assert.equal(orderCode({ sale_number: 12 }), 'PED-000012')
})
test('contrato SQL: una transaccion, backfill solo metadata y restaura triggers', () => {
  assert.match(sql, /\bbegin;/)
  assert.match(sql.trim(), /commit;$/)
  assert.match(sql, /lock table public.sales in access exclusive mode/)
  assert.match(sql, /disable trigger %I/)
  assert.match(sql, /enable %s trigger %I/)
  assert.match(sql, /where s.operation_date is null and s.status in/)
  assert.doesNotMatch(sql, /set\s+(product_cost|reseller_commission|camaraza_net_profit)\s*=/)
})
test('normaliza payment_method legacy sin alterar el resto de la venta', () => {
  const base = { id: 'venta-1', total_collected: 170000, status: 'confirmed', delivered_at: null, commission: 50000 }
  assert.deepEqual(normalizeLegacyPayment({ ...base, payment_method: 'Efectivo' }), { ...base, payment_method: 'cash' })
  assert.deepEqual(normalizeLegacyPayment({ ...base, payment_method: ' Transferencia ' }), { ...base, payment_method: 'transfer' })
  assert.deepEqual(normalizeLegacyPayment({ ...base, payment_method: 'card' }), { ...base, payment_method: 'card' })
  assert.throws(() => normalizeLegacyPayment({ ...base, payment_method: 'cripto' }), /desconocido/)
})
test('normalizacion SQL precede al backfill y mantiene el CHECK historico legitimo', () => {
  const validationAt = sql.indexOf('sales.payment_method contiene valores no reconocidos')
  const normalizationAt = sql.indexOf('set payment_method = case')
  const constraintAt = sql.indexOf('add constraint sales_payment_method_check')
  const backfillAt = sql.indexOf('set operation_date=(s.created_at')
  assert.ok(validationAt > 0 && validationAt < normalizationAt)
  assert.ok(normalizationAt < constraintAt && constraintAt < backfillAt)
  assert.match(sql, /pg_catalog\.lower\(pg_catalog\.btrim\(s\.payment_method\)\)/)
  assert.match(sql, /payment_method is null or payment_method in \('cash','transfer','card'\)/)
  assert.match(sql, /sales\.payment_timing contiene valores incompatibles/)
  assert.match(sql, /sales\.fulfillment_type contiene valores incompatibles/)
  assert.match(sql, /sales\.sale_type contiene valores incompatibles/)
  assert.match(sql, /sales\.status contiene valores incompatibles/)
})
test('expresiones especiales de PostgreSQL no se califican como funciones de pg_catalog', () => {
  assert.doesNotMatch(sql, /pg_catalog\.(?:coalesce|nullif|greatest|least)\s*\(/i)
  assert.match(sql, /coalesce\(s\.fulfillment_type, 'delivery'\)/)
})
test('contrato SQL: transicion delegada, bloqueo, retry y contacto server-side', () => {
  const body = section('admin_operate_sale_v2')
  assert.match(body, /for update/)
  assert.match(body, /v_sale.status is distinct from p_expected_status/)
  assert.match(body, /coalesce\(s.customer_contacted_at,now\(\)\)/)
  assert.match(body, /perform public.admin_transition_sale_status/)
  assert.doesNotMatch(body, /insert into public.(inventory_movements|financial_movements)/)
})
test('contrato SQL: misma fuente de saldos y liquidacion basada en pagos reales', () => {
  assert.match(section('get_my_commission_balances_v2'), /public.commission_balances_v2\(auth.uid\(\)\)/)
  assert.match(section('admin_commission_balances_v2'), /public.commission_balances_v2\(p.id\)/)
  assert.match(section('commission_sale_states_v2'), /p.status='pending'/)
  assert.match(section('commission_sale_states_v2'), /between 1 and 6/)
  assert.match(section('commission_balances_v2'), /greatest\(t.available_gross\+a.pending_adjustments,0\)/)
})
test('contrato SQL: perfil activo propio y proyecciones sin cuenta interna', () => {
  for (const name of ['get_my_operation_sales_v2', 'get_my_operation_home_v2', 'get_my_payment_receipts_v2']) {
    assert.match(section(name), /p.id=auth.uid\(\) and p.role='reseller' and p.is_active/)
  }
  for (const name of ['get_my_operation_sales_v2', 'get_my_payment_receipts_v2']) {
    assert.doesNotMatch(section(name), /'financial_account_id'|'product_cost'|'admin_notes'|'account_number'/)
  }
  assert.match(sql, /drop policy if exists "Resellers can read own commission payments"/)
  assert.match(sql, /drop policy if exists "Resellers can read own sales"/)
})
test('contrato SQL: cuentas historicas archivables, ingresos nuevos rechazados', () => {
  assert.match(section('guard_financial_account_v2'), /not coalesce\(new.is_reversal,false\)/)
  assert.match(section('guard_financial_account_v2'), /a.id=new.account_id and a.is_active/)
  assert.match(section('guard_financial_account_v2'), /public.cash_sessions/)
  assert.match(section('admin_manage_account_v2'), /foreign_key_violation/)
})
test('contrato SQL: liquidacion neta cero no crea un egreso ficticio', () => {
  assert.match(section('mark_commission_payment_paid'), /if v_payment.net_paid > 0 then/)
  assert.match(section('mark_commission_payment_paid'), /v_payment.status = 'paid'/)
  assert.match(section('mark_commission_payment_paid'), /s.status = 'delivered_paid'/)
  assert.doesNotMatch(section('mark_commission_payment_paid'), /do update set description/)
})

test('contrato SQL: venta guarda cuenta y vuelto atomicos, sin ingreso anticipado', () => {
  const body = section('admin_save_sale_v2')
  assert.match(body, /public.admin_save_sale\(/)
  assert.match(body, /v_cash < v_total/)
  assert.match(body, /financial_account_id=v_account,cash_tendered_amount=v_cash/)
  assert.match(body, /v_existing.updated_at is distinct from/)
  assert.doesNotMatch(body, /insert into public.financial_movements|admin_create_sale_income/)
})
test('contrato SQL: busqueda real limitada, por nombre SKU marca modelo y categoria', () => {
  const body = section('admin_search_sale_products_v2')
  for (const field of ['p.name', 'p.brand', 'p.model', 'd.sku', 'public.retail_product_categories']) assert.ok(body.includes(field))
  assert.match(body, /limit 20/)
  assert.doesNotMatch(body, /execute|lego|drone/i)
})
test('contrato SQL: caja agrega en servidor sin limite de 200 movimientos', () => {
  const body = section('admin_cash_day_v2')
  assert.match(body, /m.occurred_at >= p_day::timestamp at time zone 'America\/Asuncion'/)
  assert.match(body, /m.occurred_at < \(p_day\+1\)::timestamp/)
  assert.match(body, /day_opening_balance/)
  assert.doesNotMatch(body, /limit 200/)
})
