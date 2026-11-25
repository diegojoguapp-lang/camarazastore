# QA report — ciclo 01 (2026-11-25)

Base revisada: fe9ef6c. Entorno: exclusivamente pruebas autorizado. Las 12/12 pruebas Docker previas son antecedentes, no se repitieron en este ciclo.

| Prueba | Esperado | Obtenido | Estado |
| --- | --- | --- | --- |
| Catálogo de revendedores y minorista | Un producto ficticio visible | Uno en cada catálogo | PASS SQL |
| Carrito de 2 unidades | Disponible | true | PASS SQL |
| Carrito de 11 unidades con stock 10 | Rechazar | false | PASS SQL |
| Visitante anónimo | Sin acceso directo a ventas ni perfiles | Sin permisos de lectura | PASS SQL |
| Usuario SQL sin identidad | Sin acceso privado | 0 perfiles/productos/cuentas visibles | PASS SQL |
| Panel administrador | Datos accesibles a admin autorizado | Dashboard no nulo; búsqueda con 1 resultado | PASS SQL, identidad de prueba simulada |
| Venta directa V2, 2 x 150000 | Total 300000, margen 204000 | Ambos coinciden | PASS SQL |
| Reserva | Físico 10, reservado 2, disponible 8 | Coincide | PASS SQL |
| Entrega y cobro | Físico 8, reservado 0, ingreso 300000 | Coincide | PASS SQL |
| Reintento de entrega | No duplicar cobro ni stock | Físico 8, ingreso 300000 | PASS SQL |
| Devolución | Físico 10, saldo 0 | Coincide | PASS SQL |
| ROLLBACK | Sin nuevas ventas, clientes, reservas o cobros | 0; stock inicial 10 | PASS SQL |

Evidencia: consultas de solo lectura y ejecución transaccional de los procedimientos que usa la aplicación, contra el entorno autorizado; resultados detallados conservados en el informe privado. El rollback no garantiza restituir secuencias no transaccionales. No se ejecutaron pruebas de navegador en este ciclo, ni se simuló una revisión independiente. Falta prueba de autenticación con revendedores, imágenes, comisiones por API, concurrencia, rendimiento con carga y regresiones completas. No se aprueba producción.

## Ciclo 02 — 2026-11-25

| Prueba | Esperado | Obtenido | Estado |
| --- | --- | --- | --- |
| Compra borrador | Stock 10, total 144000 | Coincide | PASS SQL |
| Confirmación | Stock 13, un ingreso y un pago | Coincide | PASS SQL |
| Reconfirmación | Stock 13 y pago único | Coincide | PASS SQL |
| Retiro superior a stock | Rechazo | Rechazado | PASS SQL |
| Saldo inicial duplicado | Rechazo | Rechazado | PASS SQL |
| Retiro que afecta reservas | Rechazo | Rechazado | PASS SQL |
| Gasto de 25000 | Egreso único | Coincide | PASS SQL |
| Anulación de gasto | Saldo 0 | Coincide | PASS SQL |
| Repetición de anulación | Sin duplicación | Original y reverso | PASS SQL |
| Apertura caja | 100000 | Coincide | PASS SQL |
| Transferencia interna | Caja 70000, banco 30000, total 100000 | Coincide | PASS SQL |
| Cierre de caja | 65000, ajuste -5000 | Coincide | PASS SQL |
| Limpieza posterior | 0 operaciones nuevas, stock 10, reservas 0 | Coincide | PASS SQL |

Pruebas con contexto SQL administrativo simulado y rollback; no acreditan sesión web ni concurrencia real. La política de disponibilidad de fondos requiere confirmación comercial. Pendientes pruebas con dos revendedores, imágenes, navegador, carga y auditoría independiente. Sin aprobación de producción.


## Continuación del ciclo 02 — verificación y regresión (2026-11-25)

Base recibida y comprobada: `908e77e`. Responsable de implementación y documentación: agente principal. Revisión independiente parcial: agentes `frontend_qa` (frontend/regresión) y `review_security` (seguridad estática). Esta revisión no equivale a auditoría integral ni aprobación de producción.

| Prueba | Esperado | Obtenido | Estado / evidencia |
| --- | --- | --- | --- |
| Identidad del destino | Proyecto de pruebas autorizado activo | Identidad exacta cotejada con la indicada por el propietario; activo | PASS, conector de administración |
| Estado comercial previo | Un producto ficticio, físico 10, reservado 0, disponible 10; ninguna operación de pruebas remanente | Coincide; 0 ventas, compras, gastos y movimientos financieros | PASS SQL de solo lectura; confirma estado actual, no repite las operaciones históricas |
| Almacenamiento | Dos buckets de imágenes disponibles | No existen buckets | BLOQUEADO, consulta SQL de metadatos; no se crearon metadatos manualmente |
| Identidades QA | Dos revendedores ficticios | No existen; total de revendedores 0 | BLOQUEADO, consulta SQL de solo lectura |
| Funciones de gestión de revendedores | Disponibles para el flujo oficial | Ambas funciones activas | PASS configuración; no prueba creación ni autenticación |
| Editar producto agregando fotos | Guardar nuevas filas de galería | Reproducción local falla por desbordamiento del orden; tipo integer corroborado en Staging | FAIL reproducido en API real con transporte simulado; corregido en rama |
| Regresión de galería | Órdenes válidos después del máximo, sin perder fotos existentes | 8 casos aprobados | PASS local, `node --test tests/product-gallery.test.mjs` |
| Regresión automatizada | Pruebas locales sin fallos | 44/44 aprobadas, incluidas las 8 nuevas | PASS local, `node --test tests/*.test.mjs`; incluye mocks y contratos estáticos, no E2E |
| Compilar admin/reventa y tienda | Ambas compilaciones completas | Ambas aprobadas | PASS local, `npm run build` y `npm run build:store`; sin despliegue |
| Lint | Análisis ejecutable | Falta configuración ESLint compatible con la versión 9 | BLOQUEADO, defecto previo; `npm run lint` |
| Acceso SQL sin identidad a saldos y recibos de comisiones | Rechazo por autorización | Tres funciones rechazaron con los errores previstos | PASS SQL con rol authenticated y claims vacíos, transacción revertida; no prueba sesión real |
| Detalle de comisiones | Función invocable por el frontend autorizado | Permiso de ejecución faltante en Staging | FAIL funcional de permisos; pendiente conciliación y prueba de roles; no se ampliaron permisos |
| Navegador Staging | Acceso al panel para ejecutar flujos reales | Redirección a acceso del alojamiento; revisión automática denegó observar ese destino | BLOQUEADO por acceso; no se completaron pruebas web |

### Corrección implementada y límites

`src/lib/api.js` agrega imágenes después del mayor `sort_order` existente, usa NULLS LAST y verifica el límite de integer antes de subir las nuevas imágenes de galería. Los casos incluyen galería vacía, órdenes discontinuos, eliminación previa, orden nulo, último integer válido, desbordamiento, fallo de lectura y edición sin fotos nuevas. La prueba ejecuta la función API real empaquetada con transporte Supabase simulado.

La corrección está en código de QA, sin despliegue a Staging. Las operaciones de archivos y filas siguen sin ser atómicas; otros fallos pueden dejar archivos huérfanos o cambios parciales. Dos ediciones concurrentes aún pueden asignar órdenes iguales. Estas limitaciones no se consideran resueltas por esta corrección.

### Pendientes y acceso necesario

- Acceso al control del alojamiento para continuar desde el panel de Staging. No quitar protección ni solicitar contraseñas en el chat.
- Crear los buckets mediante el servicio oficial de Storage, con límites de tamaño y tipos de imagen; validar lectura, carga y permisos negativos.
- Crear dos revendedores por el flujo oficial; ejecutar autenticación real, aislamiento, comisiones y revocación de acceso.
- Conciliar permisos específicos y migraciones de Staging antes de validar detalle de comisiones.
- Resolver la configuración de lint; ejecutar concurrencia y carga con datos representativos una vez disponibles los fixtures oficiales. No hay benchmark ni prueba de carga en esta continuación.
- Completar los puntos de la revisión parcial de seguridad y auditoría final. El asesor mantiene advertencias sobre funciones privilegiadas y protección de contraseñas; las advertencias no se contabilizan automáticamente como vulnerabilidades confirmadas.

No se repitieron las compras/caja históricas; se verificó el estado actual documentado. No hubo escrituras persistentes en la base de datos, cuentas creadas ni objetos de Storage agregados. La política comercial de saldos negativos permanece sin cambios. No se modificó main ni producción.
