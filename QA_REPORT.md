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

## Ciclo 02 — cuentas oficiales y API real (2026-11-27)

Base de código: `254fbf4`. Ejecutor: agente principal. Revisor independiente del permiso, definiciones desplegadas y código de prueba: `review_security` (no ejecutó Auth ni modificó datos). Se verificó de nuevo la identidad exacta del proyecto de Staging antes de escribir. Las entradas anteriores describen sus fechas respectivas; los bloqueos de acceso y creación de cuentas/buckets quedaron superados en esta continuación.

| Prueba | Esperado | Obtenido | Estado / evidencia |
| --- | --- | --- | --- |
| Panel web administrativo | Sesión válida y sección Revendedores accesible | Dashboard y lista accesibles desde Chrome conectado | PASS navegador; no equivale a E2E completo |
| Alta oficial de dos revendedores ficticios | Perfiles activos vinculados a Auth | El propietario creó A/B desde el formulario; ambos activos y confirmados | PASS navegador + SQL, sin crear cuentas por SQL |
| Buckets de catálogo ficticio | Dos públicos con límites de imágenes | Ambos creados desde el Dashboard oficial, JPEG/PNG/WebP y 5242880 bytes | PASS configuración navegador + SQL; 0 objetos, carga aún pendiente |
| Detalle de comisiones | Wrapper invocable por clientes autorizados | Concedido únicamente EXECUTE de la firma revisada; anon y helpers siguen restringidos | PASS SQL antes/después; migración versionada |
| Matriz SQL de roles | A/B consultan lo propio; se deniega otro revendedor, admin e inactivos | Coincide, con rol authenticated efectivo; desactivación temporal revertida | PASS SQL simulado, separado de Auth real |
| Login real de A y B | Auth acepta las credenciales y getUser valida cada identidad | Dos identidades distintas verificadas | PASS API real, 2 comprobaciones |
| Perfiles propios y ajenos | Propio activo visible; ajeno invisible | Coincide para A y B | PASS API real, 4 comprobaciones |
| Datos bancarios ficticios distintos | Cada uno ve su fila; el otro no | Filas ficticias sembradas visibles solo al propietario | PASS API real, 4 comprobaciones; evita prueba vacía |
| Comisiones | Consulta propia y saldo permitidos; otro ID y admin denegados | Coincide para A y B | PASS API real, 8 comprobaciones; aún sin ventas/liquidaciones de comisión |
| Helpers internos | Sin ejecución directa de clientes | Denegados en ambas identidades | PASS API real, 2 comprobaciones |
| Cierre de sesiones QA | Revocar solo las sesiones creadas por esta ejecución | SignOut local exitoso; 0 sesiones QA restantes | PASS API + SQL; sesión administrativa de Chrome conservada |
| Limpieza | Retirar solo fixtures creados, preservar cuentas oficiales | 0 filas bancarias de prueba, stock 10/reservado 0, 0 ventas/compras/gastos/movimientos, 0 objetos | PASS SQL posterior; cuentas A/B siguen activas |
| Regresión local | Mantener pruebas anteriores sin fallos | 44/44 aprobadas | PASS local; no se repitieron builds sin cambio del código de aplicación |

**API real: 20/20 comprobaciones aprobadas.** El ejecutor usó SDK oficial, clave publicable y sesiones independientes en memoria; no usó service_role ni sesiones extraídas del navegador. El script opt-in `tests/staging-reseller-api.mjs` recibe configuración y credenciales por stdin, fija la identidad de Staging mediante huella, rechaza claves privilegiadas y oculta errores/secretos en salida. Las credenciales no forman parte del repositorio ni de este informe.

La migración `supabase/migrations/20261127164733_qa_restore_commission_detail_execute.sql` coincide con la versión registrada en Staging. Restaura el permiso específico ya previsto en la migración de Operación Comercial V2; no modifica las funciones ni abre sus helpers. Se volvió a consultar el asesor de seguridad tras el cambio; continúa pendiente la revisión funcional completa de las advertencias previas. La conciliación de otras diferencias históricas de Staging sigue pendiente.

No se publican identificadores privados ni evidencia sensible. Las filas de prueba representaron datos bancarios ficticios en la aplicación, sin abrir cuentas financieras ni mover dinero. Las pruebas de desactivación son SQL reversible; no acreditan revocación de un JWT previo en uso.

Pendientes: carga/visualización/eliminación real de imágenes y sus permisos; comisiones con ventas ficticias distintas, liquidación y reintentos; navegación y flujos E2E de los revendedores; cuentas desactivadas con sesión previa; concurrencia y carga representativa; lint y auditoría final. La corrección anterior de galería todavía no se desplegó. Sin cambios de main, producción ni política de fondos negativos.

## Ciclo 02 — banco, comisiones y Storage (continuación, 2026-11-27)

Base recibida: `f7d55e4`. Se agregó primero un PNG sintético de 16 × 16 píxeles, sin datos personales (`101062c`), para pruebas de archivos. Identidad de Staging nuevamente comprobada antes de operar. No se alteraron destinos comerciales.

### Comisiones con datos distintos — SQL reversible

Ejecutor: `review_security`; revisión de evidencia y consulta por el agente principal. Archivo reproducible: `tests/staging-commission.sql`. Se usaron procedimientos desplegados con rol SQL authenticated e identidades simuladas; esto NO sustituye la ejecución por Auth/API o navegador. La provisión de metadatos bancarios ficticios se hizo como operador dentro de la misma transacción, por el permiso faltante detectado antes de esta corrección.

| Escenario | Esperado y obtenido | Estado |
| --- | --- | --- |
| Cálculo y reserva | A: 1 × 150000, comisión 50000; B: 2 × 170000, comisión 140000; físico 10, reservado 3, disponible 7 | PASS SQL |
| Precio bajo mayorista | Precio 99999 rechazado, sin tercera venta | PASS SQL |
| Entrega y repetición | Físico 7, reservado 0; solo 2 ingresos, total 490000 | PASS SQL |
| Aislamiento con ventas presentes | Cada revendedor ve su venta y monto; ID ajeno rechazado en ambos sentidos | PASS SQL |
| Liquidación cruzada inválida | Venta de B rechazada en liquidación de A; sin pago creado | PASS SQL |
| Pagos pendientes | Pagos 50000/140000; A disponible 0 y en liquidación 50000 | PASS SQL |
| Pago y repetición | Solo 2 egresos, total 190000; saldo de caja 300000; no duplicación al reconfirmar | PASS SQL |
| Comprobantes propios | Un comprobante propio por cuenta; ajeno invisible; pagado A 50000/B 140000 | PASS SQL |

ROLLBACK y verificación posterior: stock 10/0/10 y sin ventas, clientes, pagos, bancos ficticios ni movimientos financieros adicionales. Las secuencias pueden avanzar aunque se revierta la transacción. El saldo de caja de la prueba no se presenta como ganancia neta.

### Banco y permisos — API real

Se reprodujo el fallo del formulario: authenticated tenía SELECT pero carecía de INSERT/UPDATE en bank_accounts. Se revisaron políticas, trigger y ausencia de recursión antes de corregirlo. La migración `20261127171841_qa_restore_bank_writes_active_profiles.sql`, aplicada solo a Staging y alineada con su historial, restaura únicamente INSERT/UPDATE y restringe las tres políticas propias al revendedor activo. Mantiene las políticas administrativas, sin conceder DELETE ni acceso anónimo.

Ejecutor: agente principal; revisor de migración y prueba: `review_security`. `tests/staging-bank-api.mjs` recibe credenciales en la primera línea de stdin y comandos de sincronización posteriores; fija Staging, usa clave publicable, memoria y salida filtrada. El operador desactiva/reactiva únicamente el perfil ficticio A entre fases, sin extraer ni reemplazar su token.

| Prueba | Esperado | Obtenido / evidencia |
| --- | --- | --- |
| Dos logins, crear y editar datos propios | Éxito y persistencia correcta | PASS API real |
| Leer/editar/insertar datos ajenos, reasignar propietario | Sin lectura ni cambios cruzados | PASS API real; estado confirmado |
| DELETE propio y operaciones anónimas | Denegados | PASS API real |
| Token existente tras desactivar A | Sin lectura, edición ni inserción propia; B sigue operativa | PASS API real |
| Reactivar A sin renovar su token | Lectura y edición propias recuperadas; datos previos intactos | PASS API real |

**26/26 comprobaciones API aprobadas.** El primer intento del ejecutor se detuvo porque exigía exclusivamente el código RLS para una inserción ajena; el trigger existente la rechazó antes. Se verificó el texto exacto del guard, se ajustó la expectativa a los dos rechazos legítimos y se limpiaron sus fixtures antes de la ejecución completa. No se modificó el servidor para cambiar ese rechazo.

La prueba acredita actualización inmediata de la autorización de datos, no revocación de Auth. Las sesiones usadas se cerraron. No se certifica inmutabilidad de todos los campos de auditoría de la fila.

### Archivos y regresión

- **8/8 comprobaciones de Storage por API real** (`tests/staging-storage-api.mjs`): dos logins y seis intentos de subir PNG válido (A, B y anónimo en ambos buckets), todos rechazados con 403. La ejecución final usa carpetas legítimas main/categories. No se crearon objetos; sesiones cerradas.
- La carga/visualización/eliminación positiva por administrador sigue pendiente. El PNG se visualizó desde GitHub y el propietario proporcionó su ruta local. Se abrió el selector real de imagen principal, pero la extensión de Chrome rechazó setFiles porque falta Allow access to file URLs. No se cambió ese permiso; se verificó placeholder original, main_image_url nulo y cero objetos tras el intento. La descarga automática previa también había fallado.
- Sigue pendiente conciliar el borrado administrativo de product-images y la limpieza de archivos huérfanos en flujos de producto/cancelación. No se crearon políticas de Storage adicionales sin prueba positiva.
- Se corrigió el guard de limpieza de retail-assets para aceptar únicamente origen, bucket y carpeta propios, rechazando rutas ajenas o con traversal. **8 pruebas nuevas locales**, ejecutando el API real con transporte simulado; no equivalen a borrado real de Storage.
- Se agregó configuración ESLint 9 y dependencia explícita fijada; corregidos 16 errores existentes sin desactivar reglas. **Lint: 0 errores, 16 advertencias de hooks aún visibles**. No se cambiaron hooks en esta pasada.
- **Regresión local: 52/52 aprobadas.** Ambas compilaciones aprobadas; build administrativo repetido tras el guard de archivos. Salidas generadas no incluidas en Git. Ejecutor de código/configuración: `frontend_qa`; revisión del diff por el agente principal.

### Muestra acotada de lecturas

`tests/staging-read-load.mjs` limita el destino a Staging y solo consulta el catálogo anónimo. Datos: un producto ficticio; 3 peticiones simultáneas. Tiempos de API medidos desde el ejecutor, incluyendo red:

| Muestra | Consultas medidas | Calentamiento separado | Errores | p50 | p95 |
| --- | --- | --- | --- | --- | --- |
| Inicial | 12 | 0 | 0 | 126 ms | 7640 ms |
| Posterior | 12 | 3 | 0 | 118 ms | 6274 ms |

Una ejecución directa de EXPLAIN ANALYZE del catálogo registró 2,617 ms de ejecución y 0,068 ms de planificación. No alcanza para atribuir los picos de API a una capa específica. Investigar latencia de cola/red/servicio; no aprobar rendimiento ni extrapolar capacidad a miles de usuarios con esta muestra. No se probó todavía concurrencia de escrituras o últimas unidades.

### Estado al limpiar y pendientes

Verificación final: físico 10, reservado 0, disponible 10; ambas cuentas QA activas; 0 sesiones QA, bancos ficticios, ventas, clientes, lotes/pagos de comisión, movimientos financieros y objetos de Storage. Se preservó el movimiento inicial de inventario preexistente.

Pendientes: permiso de archivos de la extensión para prueba positiva de imágenes, archivos huérfanos/borrado administrativo, sesiones web de revendedores y flujos E2E, ciclo de comisiones por API/navegador, concurrencia de escrituras, carga representativa y análisis de latencia, advertencias de hooks y auditoría final. Las correcciones frontend no se desplegaron; solo la migración bancaria se aplicó a Staging. Main, producción y política comercial de fondos negativos intactos.
