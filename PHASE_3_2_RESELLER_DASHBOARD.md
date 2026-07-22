# Fase 3.2 - Dashboard seguro del revendedor

Esta fase corrige el seguimiento de ventas del revendedor y rediseña `/panel`, `/panel/ventas` y `/panel/pagos` con una experiencia tipo plataforma profesional de ecommerce/dropshipping.

No ejecuta migraciones, no cambia datos existentes, no da acceso libre a `public.customers` y no usa `service_role` en frontend.

## Causa exacta

El panel anterior dependia de `public.reseller_sales`.

La vista estaba definida con:

```sql
security_invoker = true
```

y hacia:

```sql
join public.customers c on c.id = s.customer_id
```

Segun las migraciones visibles, `public.customers` tiene RLS con policies solo para admin. El reseller puede leer sus filas en `public.sales`, pero no puede leer `public.customers`.

Como la vista corre como invoker, el JOIN queda afectado por la RLS de `customers`. Resultado: la venta existe y esta asignada al revendedor, pero la vista no devuelve filas al reseller. Por eso el dashboard queda en cero.

La causa no era `commission_paid`, ni `reseller_id`, ni el rango semanal como problema principal. El rango semanal sigue usando `delivered_at`.

## Migracion

Archivo:

```text
supabase/20260722_phase_3_2_reseller_dashboard_fix.sql
```

Contiene:

- `public.get_my_sales(...)`
- `public.get_my_reseller_dashboard()`
- `SECURITY DEFINER`
- `set search_path = ''`
- owner `postgres`
- `revoke all from public`
- `grant execute to authenticated`
- `notify pgrst, 'reload schema'`
- `begin; ... commit;`

## RPC: get_my_sales

Firma:

```sql
public.get_my_sales(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_date_from date default null,
  p_date_to date default null
)
```

No recibe `reseller_id`. Usa `auth.uid()` y rechaza usuarios sin perfil `reseller` activo.

### Columnas expuestas al reseller

- `sale_id`
- `product_name`
- `product_model`
- `quantity`
- `status`
- `reseller_visible_notes`
- `product_sale_price`
- `delivery_charged`
- `total_collected`
- `reseller_commission`
- `ordered_at`
- `delivered_at`
- `created_at`
- `delivery_city`
- `customer_name`
- `customer_phone_masked`
- `customer_city`
- `commission_paid`
- `commission_paid_at`

### Datos protegidos

No devuelve:

- `customer_id`
- telefono completo
- direccion
- barrio
- mapa
- referencia
- `admin_notes`
- `product_cost`
- `delivery_cost`
- `other_costs`
- `camaraza_net_profit`
- `created_by`
- ventas de otro revendedor

El telefono se enmascara en SQL, no en React. Ejemplo:

```text
0984472119 -> 098*****19
```

## RPC: get_my_reseller_dashboard

Devuelve una sola fila con:

- `estimated_commission`
- `unpaid_confirmed_commission`
- `current_period_commission`
- `current_period_delivered_sales`
- `total_delivered_sales`
- `total_historical_commission`
- `total_paid_commission`
- `total_pending_payments`
- `next_payment_date`
- `current_period_start`
- `current_period_end`
- conteos para pipeline

## Calculos

`estimated_commission`:

```text
confirmed + preparing + out_for_delivery
```

`unpaid_confirmed_commission`:

```text
delivered_paid
and commission_paid = false
```

`current_period_commission`:

```text
delivered_paid
and delivered_at en America/Asuncion
and fecha >= lunes
and fecha < domingo
and isodow entre 1 y 6
```

`total_historical_commission`:

```text
suma historica de reseller_commission donde status = delivered_paid
```

`total_paid_commission`:

```text
suma de commission_payments.net_paid donde status = paid
```

`total_pending_payments`:

```text
suma de commission_payments.net_paid donde status = pending
```

## Regla semanal

- Zona horaria: `America/Asuncion`
- Inicio: lunes
- Fin visible: sabado
- Consulta: lunes incluido hasta domingo excluido
- Domingo no pertenece al periodo
- Campo usado: `delivered_at`

Una venta entregada el `22/07/2026` entra en el periodo `20/07/2026` a `25/07/2026`.

## Frontend

`src/lib/resellerSalesApi.js` ya no usa:

```js
supabase.from('reseller_sales')
```

Ahora usa:

```js
supabase.rpc('get_my_sales')
supabase.rpc('get_my_reseller_dashboard')
```

La vista `reseller_sales` queda deprecada para el panel. No se elimina para no romper compatibilidad.

## Diseño nuevo

`/panel`:

- sidebar desktop;
- navegacion inferior mobile;
- saludo con nombre y codigo;
- estado de cuenta;
- proximo pago;
- boton al catalogo;
- 8 tarjetas principales;
- progreso semanal con meta visual de 10 ventas;
- pipeline de pedidos;
- ventas recientes;
- acciones rapidas;
- aviso de cuenta bancaria;
- seguridad.

`/panel/ventas`:

- filtros simples;
- tabla profesional desktop;
- cards mobile;
- total de resultados;
- estado de comision;
- errores con reintento.

`/panel/pagos`:

- resumen de pagos;
- historial;
- empty state claro;
- detalle enlazado.

## Pruebas obligatorias

Con REV-0001 y venta `delivered_paid` de 50.000 Gs dentro del periodo:

- Comision confirmada semana: `50.000 Gs.`
- Comision disponible: `50.000 Gs.`
- Ventas entregadas semana: `1`
- Ventas totales: `1`
- Total historico ganado: `50.000 Gs.`
- Venta visible en ventas recientes.
- Venta visible en `/panel/ventas`.

Tambien probar:

- otro reseller no ve esa venta;
- no se devuelve telefono completo;
- no se puede pasar otro `reseller_id`;
- venta pagada pasa de disponible a cobrada;
- venta en reparto suma estimada;
- cancelada no suma;
- domingo no entra en semana;
- cambio de mes/año;
- mobile y desktop.

## Rollback

Si se necesita revertir solo la capa RPC:

```sql
begin;
drop function if exists public.get_my_sales(text, text, integer, integer, date, date);
drop function if exists public.get_my_reseller_dashboard();
notify pgrst, 'reload schema';
commit;
```

Luego revertir los cambios frontend para volver a `reseller_sales`.

## Riesgos pendientes

- La migracion no fue ejecutada desde Codex.
- `reseller_sales` queda deprecada pero existente.
- Los totales del dashboard dependen de que `commission_paid` este actualizado por el flujo de pagos.
- Si Fase 4 aun no fue ejecutada, las columnas `commission_paid` y `commission_paid_at` deben existir antes de usar estas RPC.
