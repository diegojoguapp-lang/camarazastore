# Camaraza Store Re-venta - Fase 5 UI/UX y rendimiento

## Alcance

Esta fase mejora la experiencia visual y operativa sin reconstruir los modulos existentes. Se mantuvieron Supabase Auth, roles, RLS, productos, ventas, clientes, comisiones, pagos y paneles actuales.

No se ejecutaron migraciones, no se desplego a produccion, no se modifico `.env`, no se expuso `service_role` y no se habilito registro publico ni creacion de ventas por revendedores.

## Diagnostico visual inicial

- La aplicacion tenia pantallas funcionales, pero con tarjetas y estilos repetidos.
- El bundle inicial cargaba demasiadas rutas juntas y Vite mostraba warning por chunk mayor a 500 kB.
- El panel del revendedor necesitaba mas jerarquia para ventas, pagos, objetivos y actividad.
- El admin necesitaba una vista inicial mas operativa y una busqueda centralizada.
- La Home debia mantener simpleza mobile-first y eliminar texto secundario debajo de "Panel del revendedor".

## Sistema de diseno

Se agrego `src/components/design.jsx` con componentes reutilizables:

- `PageHeader`
- `SectionHeader`
- `MetricCard`
- `StatusBadge`
- `EmptyState`
- `SkeletonCard`
- `SkeletonTable`
- `SearchInput`
- `MoneyDisplay`
- `DateDisplay`
- `ProgressBar`
- `Timeline`
- `DataTable`

Los estilos se consolidaron en `src/styles/main.css` con:

- tokens de sombra, radios y transiciones;
- skeleton loading;
- badges de estado reutilizables;
- focus visible;
- soporte `prefers-reduced-motion`;
- layouts responsive para admin, rendimiento, logros y perfil.

## Sesiones persistentes

En `src/lib/supabase.js` se configuro Supabase Auth con:

```js
auth: {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true
}
```

En `src/components/ProtectedRoute.jsx` se agrego cierre de sesion cuando el perfil existe pero esta inactivo. El acceso privado sigue validando sesion, perfil, rol y estado activo antes de renderizar admin o panel.

## Home publica

Archivo actualizado: `src/pages/Home.jsx`.

Cambios:

- Mantiene portada simple tipo Linktree.
- Conserva las opciones existentes.
- El boton "Panel del revendedor" ya no muestra descripcion secundaria.
- Se corrigio texto mojibake y se mantuvo una estructura mobile-first.

## Rutas y lazy loading

Archivo actualizado: `src/App.jsx`.

Se aplico `React.lazy` y `Suspense` para separar rutas publicas, admin y panel del revendedor. Esto evita cargar todo el admin y panel desde la Home.

Rutas nuevas del panel:

- `/panel/rendimiento`
- `/panel/logros`
- `/panel/perfil`

## Panel del revendedor

Archivos principales:

- `src/components/ResellerPanelLayout.jsx`
- `src/pages/panel/PanelHome.jsx`
- `src/pages/panel/PanelPerformance.jsx`
- `src/pages/panel/PanelAchievements.jsx`
- `src/pages/panel/PanelProfile.jsx`
- `src/lib/resellerExperienceApi.js`

Mejoras:

- Sidebar desktop y navegacion inferior mobile.
- Encabezado con saludo, codigo, estado y proximo pago.
- Dashboard con comision disponible, comision en proceso, total ganado, ventas entregadas, semana actual y pagos.
- Objetivos semanales de ventas y comision editables por el propio revendedor.
- Historial de actividad propio.
- Tarjeta de proximo pago con periodo lunes a sabado, pago lunes de 10:00 a 17:00 y domingo sin trabajo.
- Perfil separado con datos de cuenta y resumen.
- Logros separados de dashboard.
- Centro de rendimiento personal sin rankings ni comparaciones.

El revendedor no puede crear ventas desde esta fase.

## Objetivos y logros

Migracion nueva propuesta:

- `supabase/20260722_phase_5_ui_ux_performance.sql`

Tablas nuevas:

- `public.reseller_goals`
- `public.reseller_achievements`

RPC nuevas:

- `public.my_current_period()`
- `public.get_my_goals()`
- `public.update_my_goals(integer, numeric)`
- `public.sync_my_achievements()`
- `public.get_my_achievements()`
- `public.get_my_activity(integer)`
- `public.get_my_performance()`
- `public.get_admin_dashboard()`
- `public.admin_global_search(text)`

RLS:

- Admin puede leer objetivos y logros.
- Revendedor puede leer, insertar y actualizar solo sus propios objetivos.
- Revendedor puede leer solo sus propios logros.
- Los desbloqueos de logros se hacen por funcion `SECURITY DEFINER` e idempotente con unique `(reseller_id, achievement_key)`.

## Dashboard admin

Archivo actualizado:

- `src/pages/admin/AdminDashboard.jsx`

Mejoras:

- Metricas operativas reales desde RPC `get_admin_dashboard`.
- Busqueda global con debounce desde RPC `admin_global_search`.
- Alertas operativas dentro del dashboard.
- Fallback visible si la migracion de Fase 5 aun no fue aplicada.
- Se mantiene acceso solo por `AdminRoute`.

Campos finales devueltos por `get_admin_dashboard()`:

- `sales_today`
- `sales_yesterday`
- `sales_this_week`
- `sales_this_month`
- `gross_revenue`
- `net_profit`
- `pending_commissions`
- `paid_commissions`
- `pending_contact`
- `confirmed`
- `preparing`
- `out_for_delivery`
- `delivered_today`
- `cancelled_or_failed`
- `active_resellers`
- `resellers_with_sales_this_week`
- `total_customers`
- `pending_payments`
- `batches_open`
- `resellers_without_bank`

Las metricas de estado se devuelven como campos planos. `delivered_today` usa `delivered_at` en zona horaria `America/Asuncion`; `cancelled_or_failed` suma solamente `cancelled` y `failed_delivery`.

La busqueda global encuentra:

- revendedores;
- clientes;
- ventas;
- productos;
- pagos.

## Rendimiento del revendedor

`get_my_performance()` calcula el rendimiento personal con datos propios del revendedor autenticado.

Metricas corregidas:

- `sales_last_7_days`: ventas `delivered_paid` entregadas en los ultimos 7 dias usando `delivered_at`.
- `sales_last_30_days`: ventas `delivered_paid` entregadas en los ultimos 30 dias usando `delivered_at`.
- `first_sale_at`: primer `delivered_at` historico de ventas entregadas.
- `last_sale_at`: ultimo `delivered_at` historico de ventas entregadas.
- `current_sales_week_streak`: cantidad de semanas consecutivas con al menos una venta entregada.

Regla de racha:

- Semana oficial: lunes 00:00 a sabado 23:59:59.
- Domingo queda fuera del periodo.
- Zona horaria: `America/Asuncion`.
- La racha empieza en la semana actual; si la semana actual no tiene ventas, devuelve `0`.
- Se detiene en la primera semana sin ventas y limita la revision a 53 semanas para evitar loops ilimitados.

## Comprobantes

Esta fase no modifica storage ni politicas de comprobantes. El historial y detalle de pagos existentes siguen siendo la base para mostrar comprobantes cuando el modelo de pagos los tenga disponibles.

Pendiente recomendado: auditar storage privado de comprobantes antes de habilitar carga/reemplazo avanzada.

## Rendimiento

Build antes de Fase 5:

- CSS principal: `34.33 kB`, gzip `7.36 kB`
- JS inicial: `559.50 kB`, gzip `151.26 kB`
- Vite mostraba warning por chunk mayor a `500 kB`

Build despues de Fase 5:

- CSS principal: `42.98 kB`, gzip `8.81 kB`
- JS inicial: `413.55 kB`, gzip `120.28 kB`
- Se generaron chunks por rutas y ya no aparece warning de chunk grande.

## Pruebas realizadas

Comando ejecutado:

```bash
npm run build
```

Resultado:

- Build exitoso con Vite `6.4.3`.
- `1688 modules transformed`.
- Sin errores de compilacion.
- Sin warning de chunk mayor a 500 kB.

Pruebas conceptuales de correcciones menores:

- RPC y frontend usan los mismos nombres finales para dashboard admin.
- `pending_contact`, `confirmed`, `preparing` y `out_for_delivery` se cuentan por `status`.
- `delivered_today` usa `status = 'delivered_paid'` y `delivered_at` del dia actual en `America/Asuncion`.
- `cancelled_or_failed` suma `cancelled` y `failed_delivery`.
- `sales_last_7_days`, `sales_last_30_days`, `first_sale_at` y `last_sale_at` usan `delivered_at`.
- Revendedor sin ventas entregadas en la semana actual tiene racha `0`.
- Una semana sin ventas corta `current_sales_week_streak`.
- Domingo no cuenta dentro de la semana oficial lunes-sabado.

## Pasos manuales para Supabase

No ejecutar automaticamente desde el proyecto.

1. Abrir Supabase SQL Editor.
2. Revisar y ejecutar:

```sql
-- archivo
supabase/20260722_phase_5_ui_ux_performance.sql
```

3. Esperar unos segundos para refresco de schema cache.
4. Recargar la app.
5. Probar con admin:
   - `/admin`
   - busqueda global con 2 o mas caracteres.
6. Probar con revendedor:
   - `/panel`
   - editar objetivos propios;
   - `/panel/rendimiento`;
   - `/panel/logros`;
   - `/panel/perfil`.

## Rollback recomendado

Si la migracion de Fase 5 se ejecuta y hay que revertir:

```sql
begin;

drop function if exists public.admin_global_search(text);
drop function if exists public.get_admin_dashboard();
drop function if exists public.get_my_performance();
drop function if exists public.get_my_activity(integer);
drop function if exists public.get_my_achievements();
drop function if exists public.sync_my_achievements();
drop function if exists public.update_my_goals(integer, numeric);
drop function if exists public.get_my_goals();
drop function if exists public.my_current_period();
drop function if exists public.prepare_reseller_goal_row();

drop table if exists public.reseller_achievements;
drop table if exists public.reseller_goals;

notify pgrst, 'reload schema';

commit;
```

Antes de ejecutar rollback en produccion, hacer respaldo si ya existen objetivos o logros reales.

## Pasos para produccion

1. Ejecutar `npm run build`.
2. Ejecutar manualmente la migracion de Fase 5 en Supabase.
3. Validar admin y panel con usuarios reales.
4. Hacer commit.
5. Subir cambios con `git push`.
6. Verificar deployment de Vercel.
7. Probar en mobile:
   - Home;
   - login;
   - `/panel`;
   - `/admin`;
   - catalogo y producto.

## Riesgos y pendientes

- Las RPC nuevas dependen de que Fase 3 y Fase 4 existan en Supabase, especialmente ventas, pagos y lotes.
- Si la migracion no se ejecuta, el frontend muestra fallbacks de error en dashboard avanzado, objetivos, logros y rendimiento.
- KPI detallado por revendedor queda como mejora posterior en el detalle/listado de revendedores.
- Comprobantes no fueron redisenados a nivel storage privado en esta fase.
- No se agrego calendario automatico de feriados; se deja texto indicando que si el lunes es feriado puede pagarse martes.
