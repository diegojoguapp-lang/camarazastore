# Metas, operaciones diarias y retail separado

## Estado y alcance

Implementacion local. No se ejecuto SQL, no se modifico Supabase remoto, no se hizo commit, push ni deploy.
No cambia formulas financieras, reservas, consumo de stock, compras, pagos ni periodos de comisiones.
El nuevo frontend requiere la migracion antes de desplegarlo. Un build exitoso no verifica permisos ni SQL en el servidor.

## Migracion

`supabase/20260906_business_goals_daily_operations.sql`

Una transaccion BEGIN/COMMIT; requiere todas las migraciones anteriores hasta `20260822_inventory_bulk_management.sql`.
Es reejecutable sobre la estructura que ella misma crea: tablas/columnas/indices IF NOT EXISTS, policies/triggers eliminados por nombre antes de crearlos, funciones CREATE OR REPLACE con igual retorno.
No admite garantizar esquemas modificados manualmente fuera del repositorio. Un error aborta la transaccion completa; numeros de secuencias pueden dejar huecos y no deben interpretarse como cantidad de pedidos.

### Tablas

- `business_settings`: singleton `id boolean`, daily/weekly/monthly_delivered_goal, timezone, updated_at, updated_by. Valores iniciales 10/60/260; todos enteros positivos con limites SQL y frontend.
- `daily_business_closures`: business_date PK, goal, snapshot JSONB, closed_at, closed_by. El snapshot contiene entregados, coordinados, en camino, cancelados, ingresos, ganancia operativa, gastos, ganancia neta, comisiones, unidades y desglose por canal. No hay edicion manual ni recalculo implementado.

### Columnas nuevas de sales

- `sale_number bigint GENERATED ALWAYS AS IDENTITY`: secuencia automatica e indice unico. Asigna numeros a registros existentes sin UPDATE ni ejecutar triggers de ventas sobre cada registro. No promete orden cronologico de los historicos. Trigger prohibe cambiar el numero al editar.
- `cancellation_reason text`: CHECK de los ocho codigos; NULL permitido para historicos.
- `cancellation_note text`: nota opcional.
- `returned_at timestamptz`: fecha de nueva devolucion. Historicos desconocidos quedan NULL, sin inventar fechas.
- Reutiliza confirmed_at, dispatched_at (equivale a out_for_delivery_at), delivered_at, paid_at, cancelled_at y created_at.

Agregar IDENTITY puede reescribir/bloquear la tabla durante la migracion. Programar una ventana adecuada y respaldo antes de aplicarla en produccion. Referencia: [ALTER TABLE de PostgreSQL](https://www.postgresql.org/docs/current/sql-altertable.html).

### Funciones nuevas

- `prepare_sale_business_fields()` y trigger `zz_sales_business_fields`: codigo inmutable, motivo obligatorio en nuevas cancelaciones, fechas faltantes al entrar a cada estado. Repetir un estado no cambia fechas.
- `admin_cancel_sale(uuid,text,text)`: bloqueo de venta, motivo validado, nota y llamada a la transicion existente en la misma transaccion. Venta entregada requiere devolucion. Repetir cancelacion es idempotente.
- `admin_save_cancelled_sale(jsonb,uuid)`: cubre el formulario que ya ofrece Cancelado. Usa `admin_save_sale` con pending_contact transitorio (sin reservar stock), seguido de `admin_cancel_sale`, dentro de la misma transaccion. Si algo falla no se guarda la venta parcialmente. El historial refleja esas dos operaciones reales.
- `admin_save_business_goals(integer,integer,integer)`.
- `get_admin_business_report(date,date,text,boolean)`: rango con limite 367 dias; periodos today/week/month/custom; detalles por producto y revendedor opcionales.
- `get_admin_business_resellers(date)`: ranking y metricas administrativas.
- `get_admin_business_dashboard(date)`: llamada consolidada; usa resumen sin productos para no repetir detalle pesado. Dinero e inventario actuales reutilizan get_admin_finance_dashboard.
- `admin_close_business_day(date)`: serializa con el bloqueo de settings; devuelve el primer cierre si ya existe. Impide cerrar fechas futuras. Dos admins no duplican ni sobrescriben el snapshot.
- `admin_business_search(text)`: reutiliza busqueda actual y suma codigo PED. Minimo 2 caracteres, maximo 100, limite total 40 resultados; no usa SQL dinamico.

Se actualiza `validate_retail_cart(jsonb)` conservando exactamente su RETURNS TABLE anterior: no necesita DROP. Solo retorna campos publicos de productos publicados y activos; el ID solicitado se conserva aun si no esta disponible. Limita a 100 productos por validacion.

### Indices

- `sales_sale_number_unique_idx`.
- `sales_business_delivered_idx` (delivered_at, sale_type; delivered_paid).
- `sales_business_cancelled_idx` (cancelled_at; cancelled).
- `sale_events_business_status_idx` (sale_id, to_status, created_at desc; sale_created/status_changed).
- PK de ambas tablas nuevas.

### RLS y permisos

Las dos tablas nuevas tienen RLS y solo SELECT para authenticated con is_admin(). Se revocan accesos de PUBLIC/anon y escrituras directas de authenticated. Las escrituras pasan por RPC.
Todas las nuevas RPC administrativas verifican is_admin(), usan SECURITY DEFINER, search_path vacio, tablas calificadas y owner postgres. Solo authenticated recibe EXECUTE. El trigger no ofrece ejecucion directa.
validate_retail_cart permite anon/authenticated y no expone metas, cierres ni campos privados. No se amplian permisos de tablas existentes.
No se modifica la definicion de is_admin ni el login. No se usa service role en frontend.

## Semantica de los indicadores

- Dia: America/Asuncion en SQL. Rango `[inicio local, medianoche local siguiente)`, sin 23:59:59 ni dia UTC del navegador.
- Entregados, facturacion y ganancia: status = delivered_paid y delivered_at dentro del rango. Una venta creada ayer y entregada hoy cuenta hoy.
- Facturacion: SUM(total_collected), con la semantica actual de delivery.
- Ganancia operativa: SUM(camaraza_net_profit). No resta costos ni comisiones por segunda vez.
- Gastos operativos: expenses confirmados por expense_date + movimientos manual_expense no revertidos. No duplica movimientos de expenses, compras, transferencias ni pagos de comisiones.
- Ganancia neta: ganancia operativa menos gastos operativos. Compras no son perdida de resultado.
- Flujo de caja: mantiene ingresos/egresos de financial_movements, excluyendo transferencias y saldo inicial segun el sentido existente. No se confunde con utilidad.
- Coordinados/en camino/cancelados: estado actual y fecha de su ultima entrada registrada en sale_events; fallback a timestamp existente si falta evento. Asi las reactivaciones cuentan en el dia de la transicion real sin sobrescribir primeras fechas historicas. No se inventan eventos ni se usa created_at para entregados.
- Potencial: entregados + coordinados + en camino del rango. No es pronostico ni totalidad del backlog de otros dias. No hay fecha de entrega programada estructurada en el modelo actual.
- Tasa de cancelacion: cancelados / (cancelados + entregados) del rango, cero sin cierres de pedidos. No es tasa por cohorte de creacion.
- Semana empresarial: lunes a domingo inclusive (hasta dia seleccionado). No altera exclusion de domingos en COMISIONES.
- Mes: desde dia 1 hasta dia seleccionado. Promedio incluye dias calendario transcurridos y domingos.
- Racha: dias calendario consecutivos con entregados >= meta diaria actual. Hoy puede extenderla, pero un hoy aun incompleto no corta la racha de ayer. Domingo sin cumplimiento interrumpe racha empresarial.
- Cambiar metas recalcula indicadores EN VIVO con nueva meta. Los cierres conservan la meta y valores guardados.
- returned no cuenta en metricas entregadas actuales. Un cierre guardado conserva la foto original, incluso ante una devolucion posterior. No cambia ledger ni pagos.
- Dinero actual, valor de inventario y pendiente de comisiones son saldos actuales, incluso cuando se consulta un dia anterior. No pretenden reconstruir saldo historico.

## Revendedores y productos

Admin / Revendedores muestra entregados hoy/semana/mes, cancelados mes, facturacion y comision mes, comision efectivamente pagada historica (net_paid de pagos paid), pendiente bruto total de ventas delivered_paid no pagadas y ultima venta por created_at.
Pendiente total NO es liquidacion semanal ni neto tras ajustes. Incluye ventas validas de domingo igual que el saldo bruto administrativo existente; no cambia reglas de pago ni asigna pagos por fuera de lotes.
Ranking mensual ordena entregados descendente. Los agregados de pagos se calculan aparte para no multiplicarlos al unir ventas.
Reportes incluye Hoy/Semana/Mes/Personalizado y rendimiento por producto desde sale_items + ventas delivered_paid. Ganancia de producto es subtotal menos costos y comisiones de items; no reparte delivery ni gastos generales entre productos.
Stock usa products.available_stock_quantity. Vendidas 30 dias cubre hoy y los 29 dias anteriores en Asuncion, independiente del filtro del reporte. No recomienda compras.

## Pantallas y archivos

Nuevos: src/lib/adminBusinessApi.js, src/lib/businessOperations.js, src/components/CancellationFields.jsx, src/styles/business.css, src/storefront/storefront.css, esta documentacion y tests/business-operations.test.mjs, tests/business-ui.mjs, tests/business-ui-fixtures.js.
Modificados: src/pages/admin/AdminDashboard.jsx, ReportsAdmin.jsx, ResellersAdmin.jsx, SalesAdmin.jsx, SaleDetail.jsx, SaleForm.jsx; src/lib/adminDashboardApi.js, adminSalesApi.js, storefrontApi.js; src/storefront/StorefrontApp.jsx, main.jsx; vite.store.config.js; storefront.html; STORE_FRONT_DEPLOY.md.
Rutas existentes conservadas. Panel revendedor y catalogo reventa no reciben componentes administrativos nuevos. El viejo adminReportsApi queda sin uso en la pagina de Reportes; no se modifica codigo legacy.

## Pruebas locales

```powershell
node --test tests/business-operations.test.mjs
node tests/business-ui.mjs
npm run build
npm run build:store
```

El harness de UI usa Edge headless y Vite con transporte simulado. NO lee Supabase ni contiene credenciales. Requiere Edge en su ruta habitual de Windows. Guarda capturas en un directorio temporal que imprime al terminar.
Verifica 1366/1440/1920 admin, 320/375/430 retail, detalle mobile, ausencia de scroll horizontal general, configurar meta, guardar cierre, carrito persistente y bloqueo cuando stock baja 3 a 2. Estas pruebas no sustituyen pruebas RLS/SQL reales.
Unit tests cubren meta 6/10, 10/10, 13/10, cambio de meta, codigo de 7 digitos, producto omitido, precio actualizado, cantidades invalidas, duplicados y localStorage inaccesible.

Resultado local de esta ronda: 8/8 unit tests; UI sin excepciones JS en los siete escenarios de viewport y acciones descritas. npm run build y npm run build:store correctos. Retail: index.html 0.89 kB, JS 412.53 kB (119.82 kB gzip), CSS 6.22 kB (1.88 kB gzip). Admin/Dashboard: chunk 13.32 kB (4.03 kB gzip). Se verifico existencia de assets referenciados por index.html y ausencia de wholesale_price, cost_price, supplier_id y camaraza_net_profit en el bundle retail.
Los artefactos `dist-store/` se regeneraron por el build: sustituyen storefront.html por index.html y renuevan los assets compilados. No son otra implementacion manual.
Servidores de desarrollo locales: Reventa/Admin http://127.0.0.1:5173/ y Retail http://127.0.0.1:5174/. Las pruebas con datos simulados no agregan fixtures al bundle de produccion.

## Validacion manual posterior a autorizar SQL

1. Respaldar y ejecutar la unica migracion en Supabase; esta tarea NO lo hace.
2. Confirmar funciones, RLS y schema cache. La migracion incluye NOTIFY pgrst.
3. Como anon y reseller, comprobar denegacion de tablas y RPC de negocio. Como admin activo, guardar metas y cierres.
4. Confirmar ventas creadas ayer/entregadas hoy por delivered_at; medianoche local, domingo, cambio de mes y de anio. Validar canales direct=6/reseller=4/total=10.
5. Crear y editar pedido; verificar codigo unico/inmutable. Cancelar desde lista/detalle/formulario; exigir motivo y conservar nota. Verificar reservas liberadas sin duplicados.
6. Cerrar un dia dos veces y en dos sesiones: mismo snapshot, una fila. Devolver venta luego: metricas en vivo bajan, snapshot queda intacto.
7. Verificar historicos, comisiones, compras y saldos de caja sin modificaciones por la migracion.
8. Deploys y dominios solo cuando se autoricen, siguiendo STORE_FRONT_DEPLOY.md.

No se puede certificar tiempo de ejecucion, RLS real ni datos existentes del servidor sin ejecutar las pruebas en un entorno autorizado.
