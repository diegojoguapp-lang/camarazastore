# Fase 3.1 - Simplificacion del modulo de ventas

Esta correccion simplifica el formulario de ventas y evita el error 406 de Supabase al guardar o cambiar ventas a `delivered_paid`.

No borra columnas historicas, no recalcula ventas anteriores y no ejecuta SQL automaticamente.

## Causa del error 406

El error observado:

```text
Cannot coerce the result to a single JSON object
```

aparece cuando Supabase/PostgREST recibe `.single()` y la consulta devuelve cero filas o mas de una.

En este modulo el riesgo estaba en:

- `src/lib/adminSalesApi.js`
  - `createSale`
  - `updateSale`
  - `updateSaleStatus`
  - `getAdminSaleById`
- `src/lib/customerApi.js`
  - lecturas/guardados puntuales de clientes

Ahora esas consultas usan `.maybeSingle()` y validan manualmente si no vuelve fila, mostrando un error mas claro.

La busqueda por telefono ya no usa `.single()`: devuelve lista con `limit(5)`, por lo que un telefono duplicado no dispara 406.

## Migracion nueva

Archivo:

```text
supabase/20260722_phase_3_1_simplify_sales.sql
```

Incluye:

- `fulfillment_type text`
- `payment_timing text`
- CHECK de `fulfillment_type`
- CHECK de `payment_method`
- CHECK de `payment_timing`
- reemplazo seguro de `public.prepare_sale_row()`
- `notify pgrst, 'reload schema'`

La migracion esta envuelta en:

```sql
begin;
...
commit;
```

Los CHECK se crean como `NOT VALID` para no romper ventas historicas con valores libres, pero se aplican a nuevas filas y nuevas modificaciones.

## Campos eliminados de la interfaz

Se quitaron de `SaleForm`:

- Buscar por telefono.
- Barrio del cliente.
- Direccion del cliente.
- Google Maps.
- Seccion independiente de entrega.
- Barrio de entrega.
- Direccion de entrega.
- Mapa de entrega.
- Costo real del delivery.
- Otros costos.
- Monto recibido.

Las columnas siguen existiendo para ventas anteriores. Para ventas nuevas:

- `delivery_cost = 0`
- `other_costs = 0`
- `amount_received = total_collected` solo si `status = delivered_paid`; en otros estados queda `0`.
- textos eliminados se guardan como `null`.

## Estructura final del formulario

1. Revendedor
2. Producto
   - Producto
   - Cantidad
   - Costo del producto bloqueado
3. Cliente y entrega
   - Nombre completo
   - Numero de WhatsApp
   - Ciudad
   - Horario para recibir
   - Tipo de envio
4. Dinero y pago
   - Precio de venta
   - Comision del revendedor
   - Costo de envio cobrado
   - Forma de pago
   - Momento del pago
   - Total cobrado automatico
   - Ganancia Camaraza automatica
5. Estado inicial
6. Observaciones
   - Notas internas
   - Notas visibles para el revendedor

## Nuevos valores

`fulfillment_type`:

- `delivery`
- `transportadora`

`payment_method`:

- `cash`
- `transfer`
- `card`

`payment_timing`:

- `on_delivery`
- `prepaid`

## Horario

`delivery_schedule` se carga con:

```html
<input type="time">
```

El valor queda en formato `HH:mm`, por ejemplo `14:30`.

## Formato de dinero

Se agrego:

- `parseGs(value)` en `src/lib/utils.js`
- `MoneyInput` en `src/components/MoneyInput.jsx`

Visualmente muestra:

```text
150.000 Gs.
```

Internamente guarda:

```text
150000
```

## Formula final

Para ventas nuevas:

```text
total_collected =
product_sale_price + delivery_charged
```

```text
camaraza_net_profit =
product_sale_price
- product_cost
- reseller_commission
```

`delivery_charged` ya no se considera ganancia de Camaraza porque es un importe trasladado al cliente.

## Costo del producto

En la UI el costo queda bloqueado.

Ademas, la migracion refuerza la consistencia en base de datos:

- si `product_id` existe, `prepare_sale_row()` toma desde `public.products`:
  - nombre;
  - modelo;
  - `cost_price`;
  - `suggested_price` si el precio de venta llega en cero.

Esto evita confiar solo en el input bloqueado del navegador.

## delivered_paid

Al crear o actualizar una venta con `status = delivered_paid`, el trigger:

- establece `delivered_at`;
- establece `paid_at`;
- no exige `amount_received`;
- si `amount_received = 0`, lo deriva como `total_collected`.

El evento se registra por la logica existente de `sale_events`:

- alta directa: `sale_created` con `to_status = delivered_paid`;
- cambio posterior: `status_changed`.

## Seguimiento del revendedor

Se ajusto `resellerSalesApi`:

- `confirmed`, `preparing` y `out_for_delivery` suman como comision estimada.
- `delivered_paid` suma como comision confirmada.
- `delivered_paid` no pagada sigue apareciendo como comision pendiente.
- `cancelled`, `failed_delivery` y `returned` no suman confirmada.

Las consultas siguen usando la vista segura `reseller_sales`.

## Consultas corregidas

En `adminSalesApi.js`:

- `getAdminSaleById`: `.maybeSingle()`
- `createSale`: `.maybeSingle()`
- `updateSale`: `.maybeSingle()`
- `updateSaleStatus`: `.maybeSingle()`

En `customerApi.js`:

- `getCustomerById`: `.maybeSingle()`
- `createCustomer`: `.maybeSingle()`
- `updateCustomer`: `.maybeSingle()`

## Rollback

Si la migracion aun no tiene datos nuevos dependientes:

```sql
begin;
alter table public.sales drop constraint if exists sales_fulfillment_type_check;
alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales drop constraint if exists sales_payment_timing_check;
alter table public.sales drop column if exists fulfillment_type;
alter table public.sales drop column if exists payment_timing;
-- Restaurar public.prepare_sale_row() desde supabase/20260721_phase_3_sales_customers.sql si hace falta.
notify pgrst, 'reload schema';
commit;
```

Si ya existen ventas nuevas con estos campos, hacer backup antes de revertir.

## Pruebas necesarias

- Crear venta con Delivery.
- Crear venta con Transportadora.
- Efectivo + contra entrega.
- Transferencia + antes de enviar.
- Tarjeta + contra entrega.
- Horario con input time.
- Confirmar que costo producto se ve bloqueado.
- Intentar manipular costo desde DevTools y verificar que DB usa `products.cost_price`.
- Confirmar que `150.000 Gs.` guarda `150000`.
- Crear venta directamente `delivered_paid`.
- Cambiar `preparing` a `delivered_paid`.
- Confirmar que no aparece 406.
- Confirmar que no aparece `Cannot coerce the result to a single JSON object`.
- Confirmar que la venta aparece en `/panel/ventas`.
- Confirmar que la comision aparece correctamente.
- Probar cliente con telefono repetido.
- Abrir ventas historicas.

## Riesgos pendientes

- La migracion no fue ejecutada desde Codex.
- Los CHECK son `NOT VALID` para cuidar historicos; se pueden validar manualmente despues de limpiar datos antiguos.
- No se implemento deduplicacion automatica de clientes por telefono; se evita el 406 y se permite duplicado.
