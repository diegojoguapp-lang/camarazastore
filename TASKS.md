# Registro de tareas — ciclo 01 (2026-11-25)

| Tarea | Área | Estado |
| --- | --- | --- |
| Reconciliar versión desplegada y código base | DevOps | Hecho |
| Revisar estado de tablas, inventario y permisos | Backend / seguridad | Hecho |
| Completar permisos explícitos de un conjunto revisado de operaciones | Backend | Hecho en pruebas; no versionado como migración |
| Comprobar catálogos, carrito y acceso sin identidad administrativa | QA | Hecho (SQL) |
| Probar panel administrativo y búsqueda con contexto SQL de prueba | QA | Hecho (SQL) |
| Probar venta V2, entrega, reintento y devolución | QA | Hecho (SQL reversible) |
| Verificar limpieza de registros y stock | QA | Hecho |
| Revisar índices válidos | Rendimiento | Hecho; no es benchmark |
| Revisar todas las rutas y operaciones restantes | Frontend / backend | Pendiente |
| Crear almacenamiento oficial y probar imágenes | DevOps / QA | Pendiente |
| Crear dos identidades ficticias y probar aislamiento | Seguridad / QA | Pendiente |
| Ejecutar pruebas reales por navegador | QA | Pendiente |
| Prueba de carga y concurrencia real | Rendimiento | Pendiente |
| Conciliar permisos y funciones desplegadas con migraciones versionadas | DevOps | Pendiente |
| Auditoría independiente | Auditor | Pendiente |

El detalle privado de hallazgos de seguridad, identificadores y datos de prueba no se publica en este repositorio. No abrir ni fusionar PR a main para este ciclo.

## Ciclo 02 — 2026-11-25

| Tarea | Estado |
| --- | --- |
| Compras, inventario, gastos, caja y transferencias | Hecho (SQL reversible) |
| Controles negativos de inventario y reintentos secuenciales | Hecho |
| Limpieza posterior | Hecho |
| Política de saldos negativos | Decisión comercial pendiente |
| Almacenamiento oficial, dos revendedores y pruebas navegador | Bloqueado por acceso operativo |
| Concurrencia real y auditoría independiente | Pendiente |


## Continuación del ciclo 02 — 2026-11-25

| Tarea | Estado |
| --- | --- |
| Revalidar rama recibida y estado comercial actual de Staging | Hecho, solo lectura |
| Corregir desbordamiento al agregar imágenes de galería | Hecho en código QA, no desplegado |
| Regresión local y compilaciones | 44/44 pruebas y dos builds aprobados |
| Revisar cambios mediante agentes independientes | Revisión parcial real; no auditoría integral |
| Lint | Bloqueado por configuración faltante |
| Permiso del detalle de comisiones | Fallo confirmado en Staging, pendiente conciliación y pruebas de roles |
| Buckets e identidades QA | Confirmados ausentes; necesitan flujo oficial |
| Pruebas navegador | Bloqueadas por acceso al alojamiento |
| Carga, concurrencia y sesiones de dos revendedores | Pendiente; no acreditado por pruebas locales |

## Continuación del ciclo 02 — 2026-11-27

| Tarea | Estado |
| --- | --- |
| Acceso web administrativo de Staging | Desbloqueado y comprobado en Chrome |
| Alta de dos cuentas ficticias por flujo oficial | Completada por el propietario; verificada |
| Buckets públicos de imágenes con límites | Creados por el agente desde Dashboard oficial; 0 objetos |
| Permiso específico del detalle de comisiones | Corregido, revisado independientemente y versionado en migración |
| Auth real y aislamiento entre A/B | 20/20 comprobaciones API aprobadas |
| Negativas de roles, admin, helpers e inactivo | SQL reversible aprobado; parte comprobada también por API real |
| Sesiones y fixtures bancarios desechables | Sesiones cerradas y fixtures retirados; cuentas A/B preservadas |
| Imágenes, comisiones con ventas, UI reseller, carga y concurrencia | Pendientes |
| Lint, revocación con sesión previa y auditoría final | Pendientes |

## Continuación: banco, comisiones y archivos — 2026-11-27

| Tarea | Estado |
| --- | --- |
| Comisiones, entregas, liquidaciones, reintentos y recibos con ventas distintas | 8 grupos aprobados SQL reversible; API/UI aún pendiente |
| Formulario bancario sin permisos de escritura | Corregido solo en Staging; migración revisada y versionada |
| Restricción de banco a propietario activo, incluso sesión existente | 26 comprobaciones API aprobadas, incluida desactivación/reactivación |
| Storage: negar cargas de revendedores y anónimo | 8 comprobaciones API aprobadas |
| Carga positiva y eliminación de imágenes | Ruta local recibida; selector bloqueado por permiso de archivos de la extensión |
| Guard de limpieza de recursos retail | Corregido en código QA, 8 pruebas locales nuevas; no desplegado |
| Lint | Ejecutable, 0 errores; 16 advertencias hooks pendientes |
| Regresión y builds | 52/52 pruebas locales y ambas compilaciones aprobadas |
| Lecturas concurrentes acotadas | 24 consultas medidas +3 de calentamiento, sin errores; latencia p95 alta por investigar |
| Limpieza de datos/sesiones | Verificada; stock10/0/10; sin nuevas operaciones persistentes |
| E2E, concurrencia de escritura, escala y auditoría final | Pendientes |


## Imágenes desde Chrome — 2026-11-27

| Tarea | Estado |
| --- | --- |
| Selector local y carga administrativa en ambos buckets | Aprobado en navegador |
| Imagen de producto en catálogo y categoría al reabrir editor | Aprobado en navegador |
| Quitar imagen de categoría y limpiar su archivo | Aprobado navegador + SQL |
| Quitar imagen de producto y limpiar su archivo automáticamente | Falla confirmada; archivo retirado por Dashboard |
| Archivos de prueba en Storage | 0 objetos al verificar |
| Registro de categoría ficticia sin imagen | Pendiente retiro manual y verificación; confirmación nativa bloqueó control |
