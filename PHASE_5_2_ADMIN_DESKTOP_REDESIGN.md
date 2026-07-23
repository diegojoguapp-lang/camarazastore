# Fase 5.2 - Rediseño desktop del panel admin

## Alcance

Esta fase reorganiza visualmente el panel administrativo para uso en PC, manteniendo compatibilidad responsive. No modifica Supabase, RLS, migraciones, Edge Functions, formulas financieras, permisos ni estructura de datos.

## Componentes reutilizados

Archivo base:

- `src/components/AdminUX.jsx`

Componentes usados en las pantallas admin:

- `AdminPageHeader`
- `AdminMetric`
- `AdminStatusBadge`
- `FilterToolbar`
- `AdminDataTable`
- `RowActions`
- `MoneyCell`
- `DateCell`
- `Drawer`
- `StickySummary`
- `InlineLink`

## Base ya implementada

- `AdminLayout` con sidebar agrupada y topbar.
- Dashboard administrativo.
- Lista de ventas.
- Crear / editar venta.
- Lista de productos.
- Lista de revendedores.

## Pantallas completadas en esta ronda

### Clientes

Archivos:

- `src/pages/admin/CustomersAdmin.jsx`
- `src/pages/admin/CustomerDetail.jsx`

Cambios:

- Header unificado con `AdminPageHeader`.
- Métricas compactas.
- Buscador horizontal.
- Tabla densa con `AdminDataTable`.
- Detalle en dos zonas: historial principal y edición/resumen lateral.

### Comisiones

Archivos:

- `src/pages/admin/CommissionsAdmin.jsx`
- `src/pages/admin/CommissionBatchDetail.jsx`
- `src/pages/admin/CommissionPaymentForm.jsx`
- `src/pages/admin/CommissionPaymentDetail.jsx`

Cambios:

- Lotes en tabla operativa.
- Métricas de pendiente/pagado.
- Detalle de lote con acciones compactas para crear o ver pagos.
- Formulario de pago en dos columnas con resumen sticky.
- Detalle de pago con ventas pagadas y resumen lateral.

### Detalle de venta

Archivo:

- `src/pages/admin/SaleDetail.jsx`

Cambios:

- Header con acciones Volver / Editar.
- Información operativa agrupada en paneles.
- Estado y montos internos en resumen lateral sticky.
- Linea de tiempo más legible.

### Formulario de producto

Archivo:

- `src/pages/admin/ProductForm.jsx`

Cambios:

- Header unificado.
- Misma lógica y mismos campos existentes.
- Formulario en dos columnas.
- Resumen sticky con estado, precios, ganancia, stock, FAQs e imagen principal.

### Videos de ayuda

Archivo:

- `src/pages/admin/HelpVideosAdmin.jsx`

Cambios:

- Lista principal en tabla.
- Formulario de crear/editar en drawer.
- Miniatura 16:9.
- Acciones compactas editar/eliminar.
- Empty state simple.

### Redes sociales

Archivo:

- `src/pages/admin/SocialLinksAdmin.jsx`

Cambios:

- Pantalla tipo configuración.
- Una fila por red.
- Estado Cargado/Vacio.
- Formulario más compacto.

### Seguridad

Archivo:

- `src/pages/admin/AdminSecurity.jsx`

Cambios:

- Header unificado.
- Formulario compacto tipo configuración.
- Se mantiene el flujo existente de cambio de contraseña.

## Estilos

Archivo:

- `src/styles/main.css`

Se agregaron estilos `ax-*` para:

- métricas admin;
- badges de estado;
- tablas densas;
- layouts de detalle en dos columnas;
- panel lateral sticky;
- miniaturas de video;
- filas de configuración;
- responsive tablet/mobile.

## Validación

Comando ejecutado:

```bash
npm run build
```

Resultado:

- Build correcto.
- CSS final: `63.60 kB`, gzip `12.16 kB`.
- JS inicial: `420.61 kB`, gzip `122.05 kB`.

## Confirmaciones

- No se modificaron migraciones.
- No se modificó Supabase config.
- No se modificaron RLS.
- No se modificaron Edge Functions.
- No se modificó `.env`.
- No se agregaron dependencias.
- No se cambiaron formulas financieras ni permisos.

## Pendientes

- No se agregó paginación nueva para no tocar APIs ni backend.
- La búsqueda global de topbar sigue dependiendo de la RPC existente de Fase 5.
- No se hizo deploy automático.
