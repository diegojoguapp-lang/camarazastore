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
- `src/lib/dateUtils.js`
- `src/lib/resellerSalesApi.js`
- `src/pages/Reglas.jsx`
- `src/pages/Reventa.jsx`
- `src/pages/panel/PanelHome.jsx`
- `src/pages/panel/PanelSales.jsx`
- `src/styles/main.css`

## Migracion

Archivo:

```text
supabase/20260722_phase_4_commissions.sql
```

La migracion esta envuelta en:

```sql
begin;
...
commit;
```

No modifica migraciones anteriores. Agrega columnas nuevas a `public.sales` para marcar comisiones pagadas.

## Periodo

Los lotes guardan fechas como `date`:

- `period_start`: lunes.
- `period_end`: sabado.
- `payment_day`: lunes siguiente.

La base valida:

```sql
extract(isodow from period_start) = 1
extract(isodow from period_end) = 6
period_end = period_start + 5
payment_day = period_start + 7
```

Domingo no pertenece al periodo. Las ventas se validan por `delivered_at` en zona horaria `America/Asuncion`.

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

Reglas:

- Solo puede existir un lote por periodo con `unique (period_start, period_end)`.
- Un lote solo queda `paid` si tiene al menos un pago no cancelado y todos esos pagos estan `paid`.

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

- Un revendedor no puede tener dos pagos activos en el mismo lote.
- La restriccion es un indice unico parcial sobre `(batch_id, reseller_id)` cuando `status <> 'cancelled'`.
- Un pago `paid` queda inmutable.
- `status = 'paid'` exige `payment_date`.
- `net_paid = gross_commission + adjustments - discounts`, con piso en 0.

### commission_payment_items

Relaciona pagos con ventas.

Reglas:

- `unique (sale_id)` impide pagar una venta dos veces.
- Solo acepta ventas `delivered_paid` con `commission_paid = false`.
- Los items no se editan.
- Si un pago `pending` se cancela, la RPC elimina fisicamente sus items para liberar esas ventas. El pago cancelado y su evento quedan como auditoria.

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
- `payment_paid`

Nunca se borra historial desde UI ni RLS.

## RPC

Las operaciones criticas pasan por funciones transaccionales.

### public.create_commission_payment

Firma:

```sql
public.create_commission_payment(
  p_batch_id uuid,
  p_reseller_id uuid,
  p_sale_ids uuid[],
  p_adjustments numeric default 0,
  p_discounts numeric default 0,
  p_notes text default null
)
```

Valida:

- solicitante admin con `public.is_admin()`;
- batch existente y no `paid` ni `cancelled`;
- reseller activo con rol `reseller`;
- ventas existentes, del mismo revendedor, `delivered_paid`, no pagadas;
- `delivered_at` dentro del lote lunes-sabado;
- ninguna venta entregada domingo;
- venta no incluida en otro item de pago activo.

Luego crea en una unica transaccion:

- `commission_payment` en `pending`;
- `commission_payment_items`;
- snapshots de comision;
- snapshots bancarios;
- total bruto, ajustes, descuentos y neto.

Devuelve `payment_id`.

### public.mark_commission_payment_paid

Firma:

```sql
public.mark_commission_payment_paid(
  p_payment_id uuid,
  p_payment_date date,
  p_payment_method text default null,
  p_voucher_url text default null,
  p_voucher_number text default null,
  p_notes text default null
)
```

Valida admin, pago `pending`, items existentes y `payment_date` obligatorio.

Luego, en una unica transaccion:

- cambia el pago a `paid`;
- guarda metodo, comprobante y numero;
- marca todas las ventas asociadas como `commission_paid = true`;
- guarda `commission_paid_at`;
- guarda `commission_payment_id`;
- registra evento `payment_paid`;
- recalcula estado del lote.

Si no puede marcar todas las ventas incluidas, revierte todo.

### public.cancel_commission_payment

Firma:

```sql
public.cancel_commission_payment(
  p_payment_id uuid,
  p_notes text default null
)
```

Reglas:

- Solo admin.
- Solo cancela pagos `pending`.
- Un pago `paid` no se cancela sin flujo explicito de reverso.
- Elimina items del pago pending para liberar ventas.
- Mantiene el pago con `status = 'cancelled'`.
- Registra `payment_cancelled`.
- Recalcula estado del lote.

## Flujo admin

1. Admin entra a `/admin/comisiones`.
2. Crea lote del periodo actual.
3. Abre el lote.
4. El sistema lista ventas `delivered_paid` no pagadas del periodo.
5. Entra a `Crear pago` para cada revendedor.
6. El formulario trae cuenta bancaria, ventas, total comision, ajustes, descuentos, comprobante URL y numero de transferencia.
7. Al confirmar, React llama:
   - `rpc('create_commission_payment')`;
   - `rpc('mark_commission_payment_paid')`.

La interfaz ya no inserta pagos, items ni estados directamente.

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
- SELECT en pagos.
- SELECT en items.
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
- No modifica lotes.

Publico:

- Sin acceso.

Las policies de INSERT/UPDATE directo sobre `commission_payments` y de INSERT directo sobre `commission_payment_items` se eliminan. La creacion y confirmacion pasan por RPC con `SECURITY DEFINER`, `set search_path = ''`, owner `postgres`, `revoke all from public` y `grant execute to authenticated`. Cada RPC valida `public.is_admin()`.

## Reejecucion

La migracion usa:

- `drop constraint if exists` antes de recrear constraints;
- `drop index if exists` antes del indice unico parcial;
- `drop trigger if exists` antes de recrear triggers;
- `create table if not exists`;
- `create index if not exists`;
- `create or replace function`;
- `create or replace view`.

La foreign key `sales.commission_payment_id -> commission_payments.id` se recrea con `drop constraint if exists`.

## Seguridad contable

- Una venta activa no puede pagarse dos veces.
- Una venta cancelada no entra porque la RPC exige `status = 'delivered_paid'`.
- Una venta entregada domingo no entra porque se valida `extract(isodow ...) between 1 and 6`.
- Un pago `paid` no se puede modificar.
- No hay delete policies para pagos, lotes ni eventos.
- Los items solo se eliminan dentro de `cancel_commission_payment` cuando el pago esta `pending`.
- Los montos de comision vienen de `sales.reseller_commission`; el frontend no envia montos por venta.
- Si falla cualquier paso dentro de una RPC, PostgreSQL revierte la funcion completa.

## Comprobantes

Esta fase guarda `voucher_url` y `voucher_number`.

No se implementa aun subida a Storage desde el navegador. Si se desea subida real de archivos, conviene definir bucket, politicas RLS y flujo de carga en una fase separada.

## Rollback

Si no hay pagos reales:

```sql
begin;
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
drop function if exists public.refresh_commission_payment_total();
drop function if exists public.refresh_commission_batch_status_from_payment();
drop function if exists public.recalculate_commission_batch_status(uuid);
drop function if exists public.create_commission_payment(uuid, uuid, uuid[], numeric, numeric, text);
drop function if exists public.mark_commission_payment_paid(uuid, date, text, text, text, text);
drop function if exists public.cancel_commission_payment(uuid, text);
notify pgrst, 'reload schema';
commit;
```

Si ya existen pagos reales, hacer backup y no ejecutar rollback sin auditoria.

## Pruebas necesarias

- Crear lote lunes-sabado valido.
- Confirmar que martes-domingo falla.
- Confirmar que lunes-domingo falla.
- Confirmar unique por periodo.
- Crear cuenta bancaria reseller.
- Crear pago con dos ventas `delivered_paid`.
- Confirmar que falla con venta `pending`.
- Confirmar que falla con venta `cancelled`.
- Confirmar que falla con venta entregada domingo.
- Confirmar que falla si una venta ya esta pagada.
- Confirmar que `paid` exige `payment_date`.
- Confirmar que ventas quedan `commission_paid = true`.
- Confirmar que batch cambia a `paid` cuando todos sus pagos activos estan `paid`.
- Confirmar que batch sin pagos no queda `paid`.
- Cancelar pago `pending` y confirmar que sus ventas quedan disponibles.
- Confirmar que reseller ve su pago e items.
- Confirmar que reseller no puede ejecutar las RPC con exito.
- Confirmar que publico no accede.

## Riesgos pendientes

- La migracion no fue ejecutada desde Codex.
- No hay calendario automatico de feriados.
- No hay subida real de comprobantes a Storage, solo URL.
- No hay reversos contables para pagos erroneos ya marcados como `paid`.
- El frontend llama dos RPC: creacion y confirmacion. Cada RPC es transaccional; si la segunda falla queda un pago `pending` completo y auditable, sin ventas marcadas como pagadas.
- El bundle de Vite supera 500 kB; code splitting queda pendiente.
