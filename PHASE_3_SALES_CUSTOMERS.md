# Fase 3 - Clientes, ventas y comisiones por venta

Esta fase agrega clientes, ventas, estados de pedido, calculos financieros por venta, asignacion a revendedores, historial de compras, dashboard inicial del revendedor y listado de sus ventas.

No implementa pagos semanales de comisiones, comprobantes, gastos generales, flujo de caja completo, inventario avanzado, ranking, logros, metas, notificaciones, SaaS ni repartidores como usuarios.

## Archivos creados

- `supabase/20260721_phase_3_sales_customers.sql`
- `src/lib/salesConstants.js`
- `src/lib/dateUtils.js`
- `src/lib/privacy.js`
- `src/lib/customerApi.js`
- `src/lib/adminSalesApi.js`
- `src/lib/resellerSalesApi.js`
- `src/pages/admin/SalesAdmin.jsx`
- `src/pages/admin/SaleForm.jsx`
- `src/pages/admin/SaleDetail.jsx`
- `src/pages/admin/CustomersAdmin.jsx`
- `src/pages/admin/CustomerDetail.jsx`
- `src/pages/panel/PanelSales.jsx`
- `PHASE_3_SALES_CUSTOMERS.md`

## Archivos modificados

- `src/App.jsx`
- `src/components/Layout.jsx`
- `src/pages/panel/PanelHome.jsx`
- `src/styles/main.css`

## Migracion SQL

Nombre exacto:

```text
supabase/20260721_phase_3_sales_customers.sql
```

La migracion esta envuelta en:

```sql
begin;
...
commit;
```

No modifica migraciones anteriores y no debe ejecutarse automaticamente desde Codex.

## Tablas creadas

### public.customers

Campos:

- `id uuid primary key default gen_random_uuid()`
- `full_name text not null`
- `phone text not null`
- `normalized_phone text not null`
- `city text`
- `neighborhood text`
- `address text`
- `map_url text`
- `reference text`
- `requires_advance_payment boolean not null default false`
- `notes text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indice:

- `customers_normalized_phone_idx`

Estrategia para cliente existente:

- El frontend normaliza el telefono quitando caracteres no numericos.
- `getCustomerByPhone(phone)` busca coincidencias por `normalized_phone`.
- No hay unique absoluto para permitir corregir duplicados manualmente si aparecen.

### public.sales

Relaciones:

- `reseller_id -> public.profiles(id)`
- `customer_id -> public.customers(id)`
- `product_id -> public.products(id) on delete set null`
- `created_by -> auth.users(id)`

Campos principales:

- snapshots de producto: `product_name_snapshot`, `product_model_snapshot`
- estado: `status`
- montos: `product_sale_price`, `product_cost`, `delivery_charged`, `delivery_cost`, `reseller_commission`, `other_costs`, `total_collected`, `camaraza_net_profit`
- entrega snapshot: ciudad, barrio, direccion, mapa, referencia, horario
- fechas operativas: confirmada, despachada, entregada, pagada, cancelada

Constraints:

- `status` solo permite los estados definidos.
- `quantity > 0`.
- montos numericos no negativos, excepto `camaraza_net_profit`, que puede ser negativo para reflejar perdidas reales.
- trigger valida que `reseller_id` pertenezca a un perfil `reseller` activo.

### public.sale_events

Campos:

- `id`
- `sale_id`
- `actor_id`
- `event_type`
- `from_status`
- `to_status`
- `notes`
- `created_at`

Usos:

- `sale_created`
- `status_changed`
- `amount_modified`
- `status_note`

## Vista segura para revendedores

Se crea:

```text
public.reseller_sales
```

Esta vista expone solo:

- venta propia donde `sales.reseller_id = auth.uid()`
- producto snapshot
- estado
- precio vendido
- delivery cobrado
- total cobrado
- comision del revendedor
- fechas visibles
- nombre del cliente
- telefono parcialmente oculto
- ciudad del cliente

La vista se crea con:

```sql
with (security_barrier = true, security_invoker = true)
```

`security_invoker = true` hace que la vista respete los permisos/RLS del usuario que consulta.

No expone:

- `product_cost`
- `delivery_cost`
- `other_costs`
- `camaraza_net_profit`
- direccion exacta
- referencia completa
- notas internas

## Estados

- `pending_contact`: Pendiente de contacto
- `confirmed`: Confirmada
- `preparing`: En preparacion
- `out_for_delivery`: En reparto
- `delivered_paid`: Entregada y cobrada
- `cancelled`: Cancelada
- `failed_delivery`: Entrega fallida
- `returned`: Devuelta

## Formulas

Calculadas en frontend para previsualizacion y reforzadas en trigger SQL:

```text
total_collected = product_sale_price + delivery_charged
```

```text
camaraza_net_profit =
product_sale_price
- product_cost
- reseller_commission
+ delivery_charged
- delivery_cost
- other_costs
```

`camaraza_net_profit` puede ser negativo. Esto es intencional para mostrar perdidas reales en ventas donde los costos superan el ingreso.

Los snapshots quedan guardados en cada venta. Cambios posteriores en `products` no recalculan ventas historicas.

## RLS

### customers

- Admin lee todos.
- Admin inserta.
- Admin actualiza.
- Reseller no consulta libremente `customers`.
- Publico sin acceso.
- No hay delete policy.

### sales

- Admin lee todo.
- Admin inserta.
- Admin actualiza.
- Reseller lee solo `sales.reseller_id = auth.uid()`.
- Reseller no inserta, no actualiza y no elimina.
- Publico sin acceso.
- No hay delete policy.

### sale_events

- Admin lee todos.
- Admin inserta.
- Reseller lee eventos solo si la venta es propia.
- Reseller no inserta ni modifica.
- Publico sin acceso.

## Que ve admin

- Clientes completos.
- Direcciones, mapa, referencia y notas.
- Revendedor asignado.
- Producto y snapshots.
- Costos internos.
- Delivery cobrado y costo real.
- Comision.
- Otros costos.
- Total cobrado.
- Ganancia neta Camaraza.
- Historial y eventos.

## Que ve reseller

- Sus ventas.
- Producto.
- Fecha.
- Estado.
- Precio vendido.
- Comision.
- Fecha de entrega.
- Nombre del cliente.
- Telefono parcialmente oculto.
- Ciudad.
- Notas visibles para reseller.

No ve datos internos de Camaraza ni informacion privada completa del cliente.

## Rutas nuevas

Admin:

- `/admin/ventas`
- `/admin/ventas/nueva`
- `/admin/ventas/:id`
- `/admin/ventas/:id/editar`
- `/admin/clientes`
- `/admin/clientes/:id`

Revendedor:

- `/panel/ventas`

## Como ejecutar la migracion

1. Hacer backup de Supabase.
2. Confirmar que Fase 1 y Fase 2 ya estan ejecutadas.
3. Abrir Supabase Dashboard.
4. Ir a SQL Editor.
5. Copiar todo el contenido de:

```text
supabase/20260721_phase_3_sales_customers.sql
```

6. Ejecutarlo una vez.
7. Esperar el `notify pgrst, 'reload schema';`.
8. Recargar la app.

## Como probar nueva venta

1. Entrar como admin.
2. Ir a `/admin/ventas`.
3. Presionar `Nueva venta`.
4. Seleccionar revendedor activo.
5. Seleccionar producto existente.
6. Buscar cliente por telefono.
7. Si no existe, cargar cliente nuevo.
8. Cargar entrega y dinero.
9. Verificar calculo en vivo.
10. Guardar.
11. Confirmar redireccion al detalle.

## Como probar cliente existente

1. Crear una primera venta con telefono del cliente.
2. Crear otra venta.
3. Buscar el mismo telefono.
4. Elegir el cliente encontrado.
5. Guardar.
6. Revisar `/admin/clientes/:id` y confirmar historial.

## Como cambiar estados

1. Abrir `/admin/ventas/:id`.
2. Cambiar estado.
3. Guardar.
4. Confirmar evento `status_changed`.
5. Confirmar fechas automaticas:
   - `confirmed` carga `confirmed_at`.
   - `out_for_delivery` carga `dispatched_at`.
   - `delivered_paid` carga `delivered_at` y `paid_at`.
   - `cancelled` carga `cancelled_at`.

## Como verificar comision semanal

1. Crear venta propia de un revendedor.
2. Cambiar a `delivered_paid`.
3. Confirmar que `delivered_at` cae dentro del periodo sabado-viernes.
4. Entrar como revendedor.
5. Abrir `/panel`.
6. Verificar:
   - comision confirmada semana;
   - ventas entregadas semana;
   - total historico ganado.

El helper `getCurrentCommissionPeriod()` calcula el periodo en zona horaria `America/Asuncion`. Inicio sabado 00:00 y fin viernes 23:59:59.

El fin del periodo se calcula como inicio + 7 dias - 1 milisegundo para evitar ambiguedades con horas UTC.

## Como verificar privacidad

1. Entrar como revendedor.
2. Abrir `/panel` y `/panel/ventas`.
3. Confirmar que solo aparecen ventas propias.
4. Confirmar que el telefono aparece oculto parcialmente.
5. Confirmar que no aparecen direccion completa, costos internos ni ganancia Camaraza.
6. Intentar consultar `customers` desde una sesion reseller: debe estar bloqueado por RLS.
7. Intentar insertar/update en `sales` como reseller: debe estar bloqueado por RLS.

## Rollback

Si aun no hay ventas reales:

```sql
begin;
drop view if exists public.reseller_sales;
drop table if exists public.sale_events;
drop table if exists public.sales;
drop table if exists public.customers;
drop function if exists public.log_sale_event();
drop function if exists public.prepare_sale_row();
drop function if exists public.prepare_customer_row();
drop function if exists public.normalize_customer_phone(text);
notify pgrst, 'reload schema';
commit;
```

Si ya hay ventas reales, hacer backup antes de cualquier rollback.

## Riesgos pendientes

- La migracion no fue ejecutada desde Codex.
- Las pruebas RLS reales deben hacerse en Supabase con usuarios admin y reseller.
- El bundle de Vite supera 500 kB y convendria code splitting en otra fase.
- `PHASE_1_ROLES_SETUP.md` menciona `current_profile_role()` aunque la migracion actual fue corregida luego.
- No hay pagos semanales ni comprobantes todavia.
- No hay flujo de caja completo ni gastos.
- No hay inventario avanzado.

## Fase 4 pendiente

- Pagos de comisiones.
- Comprobantes.
- Gastos generales.
- Flujo de caja.
- Reportes financieros.
- Mejor auditoria administrativa.
- Posible code splitting por rutas admin/panel.
