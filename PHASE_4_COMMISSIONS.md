# Fase 4 - Comisiones, cierres y pagos

Esta fase agrega comisiones, cierres semanales, pagos a revendedores, cuenta bancaria, comprobantes por URL y auditoria financiera.

No implementa gastos generales, flujo de caja completo, inventario, ranking, logros, bonos, metas, repartidores ni SaaS.

## Archivos creados

- `supabase/20260722_phase_4_commissions.sql`
- `src/lib/commissionConstants.js`
- `src/lib/adminCommissionsApi.js`
- `src/lib/resellerCommissionsApi.js`
- `src/pages/admin/CommissionsAdmin.jsx`
- `src/pages/admin/CommissionBatchDetail.jsx`
- `src/pages/admin/CommissionPaymentForm.jsx`
- `src/pages/admin/CommissionPaymentDetail.jsx`
- `src/pages/panel/BankAccount.jsx`
- `src/pages/panel/PanelPayments.jsx`
- `src/pages/panel/PanelPaymentDetail.jsx`
- `PHASE_4_COMMISSIONS.md`

## Archivos modificados

- `src/App.jsx`
- `src/components/Layout.jsx`
- `src/lib/resellerSalesApi.js`
- `src/pages/panel/PanelHome.jsx`
- `src/styles/main.css`

## Migracion

Archivo:

```text
supabase/20260722_phase_4_commissions.sql
```

La migracion esta envuelta en:

```sql
BEGIN;
...
COMMIT;
```

No modifica migraciones anteriores. Agrega columnas nuevas a `public.sales` para marcar comisiones pagadas.

## Tablas

### commission_batches

Representa un cierre semanal.

Campos principales:

- `period_start`
- `period_end`
- `payment_day`
- `status`: `draft`, `ready`, `paid`, `cancelled`
- `created_by`
- `notes`

Regla:

- Solo puede existir un lote por periodo con `unique (period_start, period_end)`.

### commission_payments

Representa el pago a un revendedor.

Campos principales:

- `batch_id`
- `reseller_id`
- snapshots bancarios
- `gross_commission`
- `adjustments`
- `discounts`
- `net_paid`
- `payment_date`
- `payment_method`
- `voucher_url`
- `voucher_number`
- `status`: `pending`, `paid`, `cancelled`

Reglas:

- Un revendedor no puede tener dos pagos en el mismo lote.
- Un pago `paid` queda inmutable.
- `net_paid = gross_commission + adjustments - discounts`, con piso en 0.

### commission_payment_items

Relaciona pagos con ventas.

Reglas:

- `unique (sale_id)` impide pagar una venta dos veces.
- Solo acepta ventas `delivered_paid` con `commission_paid = false`.
- Los items no se editan.

### bank_accounts

Cuenta bancaria principal del revendedor.

Campos:

- banco
- alias
- titular
- documento
- tipo de cuenta
- `is_primary`

Regla:

- No permite mas de una cuenta principal por revendedor.

### commission_events

Auditoria financiera.

Eventos:

- `batch_created`
- `payment_created`
- `payment_cancelled`
- `voucher_uploaded`
- `adjustment_added`

Nunca se borra historial desde UI ni RLS.

## Flujo admin

1. Admin entra a `/admin/comisiones`.
2. Crea lote del periodo actual.
3. Abre el lote.
4. El sistema lista ventas `delivered_paid` no pagadas del periodo.
5. Entra a `Crear pago` para cada revendedor.
6. El formulario trae:
   - cuenta bancaria;
   - ventas;
   - total comision;
   - ajustes;
   - descuentos;
   - comprobante URL;
   - numero de transferencia.
7. Al confirmar:
   - crea `commission_payments`;
   - crea `commission_payment_items`;
   - cambia el pago a `paid`;
   - trigger marca ventas como `commission_paid = true`.

## Flujo reseller

Rutas:

- `/panel/cuenta-bancaria`
- `/panel/pagos`
- `/panel/pagos/:id`

El revendedor puede:

- cargar o editar su cuenta bancaria principal;
- ver sus pagos;
- ver ventas incluidas en cada pago;
- abrir comprobante si existe.

No ve ganancia Camaraza ni costos internos.

## Dashboard reseller

- Comision pendiente: ventas propias `delivered_paid` con `commission_paid = false`.
- Comision confirmada semana: ventas propias `delivered_paid` dentro del periodo lunes-sabado por `delivered_at`.
- Comision cobrada: suma historica de `commission_payments.net_paid` con `status = paid`.
- Proximo pago: lunes de 10:00 a 17:00.

## RLS

Admin:

- SELECT/INSERT/UPDATE en lotes.
- SELECT/INSERT/UPDATE en pagos.
- SELECT/INSERT en items.
- SELECT/INSERT/UPDATE en cuentas bancarias.
- SELECT/INSERT en eventos.

Revendedor:

- SELECT solo de sus pagos.
- SELECT solo de sus items.
- SELECT/INSERT/UPDATE solo de su cuenta bancaria.
- SELECT de eventos asociados a sus pagos.
- No crea pagos.
- No cambia estados.
- No edita items.

Publico:

- Sin acceso.

## Seguridad

- Una venta no puede pagarse dos veces por `unique (sale_id)`.
- Un pago `paid` no se puede modificar.
- No hay delete policies para pagos, items, lotes ni eventos.
- No se puede marcar pago como `paid` sin items.
- Los totales del pago se refrescan desde los items antes de confirmar.

## Comprobantes

Esta fase guarda `voucher_url` y `voucher_number`.

No se implementa aun subida a Storage desde el navegador. Si se desea subida real de archivos, conviene definir bucket, politicas RLS y flujo de carga en una fase separada.

## Cancelacion

Se permite cancelar pagos que todavia no estan `paid`.

Un pago `paid` queda inmutable. Si se paga por error, se recomienda resolverlo en una fase futura con reversos o ajustes auditados, no editando el pago historico.

## Rollback

Si no hay pagos reales:

```sql
BEGIN;
alter table public.sales drop constraint if exists sales_commission_payment_fk;
alter table public.sales drop column if exists commission_payment_id;
alter table public.sales drop column if exists commission_paid_at;
alter table public.sales drop column if exists commission_paid;
drop table if exists public.commission_events;
drop table if exists public.commission_payment_items;
drop table if exists public.commission_payments;
drop table if exists public.commission_batches;
drop table if exists public.bank_accounts;
drop function if exists public.prepare_commission_batch_row();
drop function if exists public.prepare_commission_payment_row();
drop function if exists public.prepare_commission_payment_item_row();
drop function if exists public.prepare_bank_account_row();
drop function if exists public.log_commission_event();
drop function if exists public.mark_sales_commission_paid();
drop function if exists public.refresh_commission_payment_total();
notify pgrst, 'reload schema';
COMMIT;
```

Si ya existen pagos reales, hacer backup y no ejecutar rollback sin auditoria.

## Riesgos pendientes

- La migracion no fue ejecutada desde Codex.
- La creacion de pago desde frontend usa varios pasos Supabase. Si falla a mitad, puede quedar un pago `pending`; no marca ventas como pagadas ni duplica items, pero conviene una RPC transaccional futura.
- No hay calendario automatico de feriados.
- No hay subida real de comprobantes a Storage, solo URL.
- No hay reversos contables para pagos erroneos ya marcados como `paid`.
- El bundle de Vite supera 500 kB; code splitting queda pendiente.

## Pruebas necesarias

- Crear lote.
- Confirmar unique por periodo.
- Crear cuenta bancaria reseller.
- Crear pago con ventas delivered_paid no pagadas.
- Confirmar que ventas quedan `commission_paid = true`.
- Intentar pagar la misma venta otra vez.
- Confirmar que reseller ve su pago e items.
- Confirmar que reseller no puede crear pagos.
- Confirmar que publico no accede.
