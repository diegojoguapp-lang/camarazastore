# Fase 5.1 - Rediseño UX del panel revendedor

## Diagnostico

El panel anterior funcionaba, pero la arquitectura de informacion hacia que Inicio fuera demasiado largo. Banco, seguridad, objetivos, actividad, acciones rapidas, estados y ventas recientes competian en una sola pantalla. Tambien habia demasiadas tarjetas similares y una navegacion mobile con secciones poco claras.

## Arquitectura anterior

- `/panel`: dashboard largo con ventas, banco, objetivos, actividad, seguridad y accesos.
- `/panel/ventas`: listado de ventas.
- `/panel/pagos`: pagos.
- `/panel/rendimiento`: rendimiento.
- `/panel/logros`: logros.
- `/panel/perfil`: perfil basico.
- `/panel/cuenta-bancaria`: formulario bancario.

## Arquitectura nueva

Navegacion inferior principal:

- Inicio: `/panel`
- Ventas: `/panel/ventas`
- Pagos: `/panel/pagos`
- Progreso: `/panel/progreso`
- Perfil: `/panel/perfil`

Rutas preservadas:

- `/panel/rendimiento`
- `/panel/logros`
- `/panel/cuenta-bancaria`
- `/panel/pagos/:id`

Ruta agregada:

- `/panel/ventas/:id`

## Elementos movidos

- Inicio queda corto: pedidos recientes y cuatro metricas.
- Ventas concentra listado, filtros y detalle de pedido.
- Pagos concentra proximo pago, pendiente, cobrado, historial y comprobantes.
- Progreso concentra rendimiento, objetivos y logros mediante tabs.
- Perfil concentra datos personales, banco, seguridad, actividad y accesos.

## Componentes creados

- `CompactPageHeader`
- `CompactMetricCard`
- `OrderListItem`
- `StatusDot`
- `StatusBadge`
- `OrderTimeline`
- `SettingsRow`
- `SegmentedTabs`
- `ActivityListItem`

Archivo:

- `src/components/ResellerUX.jsx`

## Mapa de estados

Centralizado en `src/lib/resellerDisplay.js` y alineado con `src/lib/salesConstants.js`.

- `pending_contact`: Pendiente de coordinacion
- `confirmed`: Coordinado con el cliente
- `preparing`: Preparando pedido
- `out_for_delivery`: Entrega en curso
- `delivered_paid`: Entregado y cobrado
- `cancelled`: Cancelado
- `failed_delivery`: Entrega fallida
- `returned`: Devuelto

Los estados usan punto, texto y badge discreto. No se pinta toda la card con colores fuertes.

## Actividad

La actividad reciente se movio a Perfil y se humaniza desde `resellerDisplay.js`.

No se muestran claves como `first_sale` o `delivered_paid` al usuario final. Los logros se muestran con nombres humanos.

## Posible entrega

No existe un dato explicito expuesto al panel para "posible entrega". No se creo migracion ni se invento el dato. Cuando no hay fecha de entrega real, se muestra:

- Entrega por coordinar

## Credenciales

El admin copia credenciales con este formato:

```text
Credenciales *Panel Revendedor*

*ACCESO*
*Correo:* [CORREO_REAL]
*Contraseña:* [CONTRASEÑA_TEMPORAL_REAL]

Ingresar en:
https://camarazareventa.com/login

*Código Revendedor:* [CODIGO_REAL]
*Nombre:* [NOMBRE_REAL]
```

No se guarda la contraseña. Se usa solamente el valor temporal disponible al crear o restablecer.

## Sistema visual

Se agrego una capa `rx-*` mobile-first:

- pedidos como filas compactas;
- metricas compactas;
- settings como filas;
- timeline vertical;
- tabs segmentadas;
- barra inferior con safe-area.

Se preserva el lazy loading existente y no se agregan dependencias.

## Responsive

Prioridad mobile:

- 320 px;
- 360 px;
- 375 px;
- 390 px;
- 430 px.

La barra inferior usa:

- cinco columnas;
- `env(safe-area-inset-bottom)`;
- padding inferior en el shell para no tapar contenido.

## Pruebas

Ejecutar:

```bash
npm run build
```

Checklist funcional:

- Inicio no contiene banco, seguridad, objetivos editables, actividad completa ni acciones rapidas.
- Inicio muestra pedidos primero.
- Inicio muestra maximo cuatro metricas.
- Barra inferior: Inicio, Ventas, Pagos, Progreso, Perfil.
- No aparece "Rend." en la barra inferior.
- Ventas recientes estan en Ventas.
- Proximo pago completo esta en Pagos.
- Objetivos y logros estan en Progreso.
- Banco, seguridad, actividad y accesos estan en Perfil.
- El revendedor no puede crear ventas.
- Copiar credenciales usa el formato solicitado.

## Rollback

Revertir los cambios de:

- `src/components/ResellerUX.jsx`
- `src/lib/resellerDisplay.js`
- `src/components/ResellerPanelLayout.jsx`
- paginas bajo `src/pages/panel`
- `src/pages/admin/ResellersAdmin.jsx`
- `src/styles/main.css`
- `src/App.jsx`

No hay migracion ni cambio de base de datos para revertir.

## Riesgos

- El dato "posible entrega" no existe como campo dedicado; se muestra solo entrega real o "Entrega por coordinar".
- El detalle de venta del revendedor usa la lista segura existente `get_my_sales`; si la lista se pagina por debajo de 100 ventas antiguas, un pedido muy viejo podria no encontrarse desde URL directa.
