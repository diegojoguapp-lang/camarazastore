# Operacion Comercial V2 - Informe de implementacion

Fecha: 2026-09-08. Proyecto: Camaraza Store / Camaraza Reventa.

**Alcance de la validacion:** implementacion local, pruebas unitarias, contratos SQL estaticos, componentes reales en navegador con transporte de pruebas aislado y builds. **No se ejecuto SQL ni se verificaron operaciones reales en Supabase.** Las fixtures estan exclusivamente en `tests/` y no forman parte de la aplicacion. No se hizo git add, commit, push ni deploy.

### 1. Arquitectura encontrada

React 18, React Router 7, Vite 6 y cliente Supabase. Dos builds independientes. Ventas multiproducto: `sales` y `sale_items`. La funcion `admin_save_sale` guarda snapshots comerciales y reservas; `admin_transition_sale_status` centraliza entrega, consumo de stock, ingreso y devolucion. Estados existentes conservados. Finanzas usa `financial_accounts` y `financial_movements`; caja usa `cash_sessions`. Comisiones usa `commission_batches`, `commission_payments`, `commission_payment_items`, `commission_adjustments`, `commission_payment_adjustments` y eventos existentes. No se crea otro ledger ni otro sistema de comisiones.

### 2. Operacion de hoy

Nueva ruta protegida `/admin/operacion`, componente `DailyOperations`, acceso despues de Dashboard. Exactamente tres columnas: Coordinado, En camino, Entregado. Fecha inicial de America/Asuncion; consulta exclusivamente `operation_date`. Contadores, productos, imagen, codigo PED, cliente, telefono, entrega, ciudad, total, medio/cuenta de cobro y vuelto. Consultas paginadas internamente para no truncar silenciosamente a 1.000 ventas. No hay acciones de logistica avanzada.

### 3. Cliente contactado

`sales.customer_contacted_at`. Checkbox disponible en Coordinado; la RPC escribe `now()` al marcar y `null` al desmarcar, preservando el primer timestamp en un reintento. No acepta timestamp del navegador. Solo admin activo; persiste en base cuando se aplique la migracion. WhatsApp normaliza numeros paraguayos, abre `wa.me` sin texto automatico y queda deshabilitado ante numero inexistente/invalido.

### 4. Transiciones

`admin_operate_sale_v2` bloquea la venta con `FOR UPDATE`, compara estado esperado y delega a `admin_transition_sale_status`. Permite Coordinado -> En camino y En camino -> Entregado/cobrado. Reintentar una transicion ya completada no repite efectos. La UI bloquea acciones simultaneas. Cancelar/devolver continua en el detalle existente; no se habilita regresar libremente desde una venta entregada. En edicion comercial, la nueva RPC compara tambien el `updated_at` originalmente leido.

### 5. Nueva Venta V2

`SaleForm` usa busqueda RPC limitada a 20 resultados, debounce de 300 ms, nombre, SKU, marca, modelo y categorias retail realmente asignadas. No agrega sinonimos ni productos ficticios. Resultados con foto y stock. Conserva multiples items y precios dinamicos. Fecha Hoy/Manana/personalizada, cuenta y medio de cobro, vuelto opcional. Se retira el input Horario; el campo historico y las notas se conservan. `admin_save_sale_v2` llama al guardado canonico y actualiza metadata dentro de la misma transaccion: un fallo revierte venta, items y reservas de esa llamada. La creacion de cliente sigue siendo la operacion separada preexistente.

### 6. Cobros

Valores canonicos `cash`/`transfer` en nuevas ventas. Cuenta activa y de tipo compatible obligatoria. El total procede de `sales.total_collected`, sin duplicar delivery. `cash_tendered_amount` es opcional; el servidor comprueba que cubra ese total. Vuelto = efectivo recibido - total, solo informativo: el ingreso es el total de venta, no el billete recibido. Guardar/coordinar/despachar no inserta ingresos; entregar reutiliza el ingreso canonico. Si falta cuenta, se intenta el default; si no existe cuenta valida se rechaza la entrega con mensaje entendible.

### 7. Cuentas predeterminadas

Se reutiliza `business_settings`: `default_cash_account_id` y `default_transfer_account_id`, FK a cuentas. Una cuenta por metodo en el singleton. `admin_set_collection_defaults` valida actividad y tipo, con bloqueo compartido de cuentas. Finanzas permite configurarlas; Nueva Venta las precarga. No se asignan cuentas inventadas a ventas historicas.

### 8. Gestion de cuentas

Se reutiliza `financial_accounts.is_active`. Editar nombre/banco no modifica saldo ni ledger. El tipo y saldo inicial de cuentas existentes quedan bloqueados. Archivar advierte el saldo, conserva movimientos, quita defaults y bloquea nuevas operaciones; no crea transferencias artificiales. Caja abierta debe cerrarse primero. Listado con Activas/Archivadas/Todas. Eliminar exige ausencia de historial/referencias mediante trigger y FK RESTRICT, ademas de confirmacion UI. TEST ITAU puede archivarse manualmente; no se modifico ningun dato suyo. Dinero actual operativo suma SOLO activas; historial incluye tambien archivadas.

### 9. Caja diaria

`admin_cash_day_v2` calcula ingresos, egresos y saldo inicial del dia por cuenta en servidor, sin el limite anterior de 200 movimientos ni recorte UTC. Ventana: medianoche Asuncion inclusiva a medianoche siguiente exclusiva. Cuentas bancarias aparecen como tarjetas con saldo continuo, recibido y egresos del dia, sin apertura bancaria. Efectivo mantiene apertura/cierre, esperado, contado y diferencia. Registrar una diferencia como movimiento sigue siendo una opcion explicita, desmarcada por defecto.

### 10. Panel revendedor

Home con saludo breve, pedidos propios de hoy y tres contadores. Hasta cinco pedidos recientes por estado en Home; Ventas permite consultar el resto con paginacion. Foto, PED, cliente limitado, total, comision y fecha operativa. Resumen semanal actual/anterior: pedidos por fecha operativa, entregados y ventas por `delivered_at`, comision oficial sin domingo. Ninguna cuenta Camaraza, costo, proveedor o nota privada forma parte de la proyeccion nueva.

### 11. Ventas revendedor

`PanelSales`: Hoy, semana actual, anterior, mes completo, personalizado y Todas. Estado y busqueda en servidor, paginas de 20. `PanelSaleDetail` consulta por ID autorizado, corrigiendo el antiguo limite de buscar solo entre las primeras 100 ventas. Los historicos sin `operation_date` siguen accesibles en Todas y por ID; no se les inventa fecha. No existe un formulario activo de creacion de pedidos por reseller en esta arquitectura; la condicion del prompt de adaptar uno existente no aplica y no se agrega capacidad de escritura.

### 12. Comisiones

`commission_sale_states_v2` clasifica ventas; `commission_balances_v2` calcula saldos. Ambas son helpers privados sin EXECUTE para publico/anon/authenticated. Wrappers autorizados los consumen desde Admin y reseller. `CommissionsAdmin`, Home, Pagos, resumen reseller y Rendimiento usan esta fuente. El indicador Por pagar del Dashboard tambien suma Disponible; no se modifican sus metricas de ventas ni el cierre historico.

### 13. Estados de comision

- Por confirmar: comisiones de ventas abiertas, no ingresos ganados.
- Disponible bruto: `delivered_paid`, lunes-sabado por `delivered_at`, sin comision pagada y sin pago pendiente asociado.
- Disponible neto: `greatest(disponible_bruto + ajustes_negativos_pendientes, 0)`. Los ajustes se muestran aparte; no se oculta la deuda restante.
- En liquidacion: suma `net_paid` de `commission_payments.status = 'pending'`. Un lote semanal generado automaticamente NO mueve dinero a esta categoria por si solo.
- Pagado: suma neta de pagos confirmados. Pagado mes usa fechas de pago del mes de Asuncion.

Las ventas del desglose muestran comision bruta; las liquidaciones detallan descuentos/ajustes y neto. Canceladas, fallidas y devueltas no generan nueva comision disponible. Un pago historico de una venta devuelta se conserva junto con el ajuste existente.

### 14. Caso Alba

No se modificaron datos de Alba. Si el helper devuelve `available = 50000` para su ID, la respuesta propia devuelve esos mismos 50000 y Admin los incorpora a la suma global, independientemente de Hoy/semana en la tabla. Con ajustes pendientes, ambos muestran el mismo neto. **La igualdad con los datos reales de Alba queda pendiente del smoke test**, no se afirma haberla comprobado contra produccion.

### 15. Admin Comisiones

KPIs globales: Por pagar, En liquidacion, Pagado mes y Ajustes pendientes. Tabla por revendedor con Disponible, Por confirmar, En liquidacion, Pagado y Ajustes. Conserva las consultas por periodo como contexto comercial, no como filtro del saldo global. Detalle permite recorrer ventas por cada estado de comision y abrirlas. Datos bancarios para pagar visibles solo en Admin y en el comprobante propio del reseller.

### 16. Liquidaciones

Nueva ruta real `/admin/comisiones/pagos` con pendientes/pagadas/canceladas y acceso a lotes. Antes ese enlace se interpretaba como `/admin/comisiones/:id` con ID `pagos`. Preparar usa `create_commission_payment` sin confirmar pago; crea la liquidacion pendiente y reserva los ajustes segun el modelo existente. Confirmar desde detalle usa `mark_commission_payment_paid`; cancelar usa la RPC existente. Si una confirmacion falla, se conserva el ID pendiente y se dirige a su detalle para no crear otro pago. Admin y reseller ven periodo, ventas PED, importes, ajustes, neto, estado, fecha y comprobante.

### 17. Devoluciones

Se conservan `admin_return_sale_stock`, `admin_reverse_sale_income` y los ajustes negativos de la macrofase anterior. No se reescriben pagos historicos. Las reversiones pueden usar la cuenta historica archivada, porque no representan una nueva operacion comercial. La nueva version de `mark_commission_payment_paid` evita insertar un egreso ficticio de cero cuando los ajustes absorben toda la comision; conserva las validaciones, snapshots y marca de ventas pagadas.

### 18. Domingo

Periodo oficial lunes 00:00 a domingo 00:00 exclusivo. Se mantiene el constraint de lotes lunes-sabado y pago lunes siguiente. Se corrigio `toDateOnly` de lotes: antes convertir el instante final a UTC podia producir domingo; ahora usa fecha Asuncion. La semana operativa puede incluir domingo, pero la comision oficial utiliza `delivered_at` y lo excluye. Textos de pago lunes 10:00-17:00, martes si feriado; no hay calendario automatico nuevo.

### 19. Dashboard / Cierre

`operation_date` programa el trabajo; `delivered_at` determina entrega real, facturacion y metricas/cierre existentes. No se reemplaza uno por otro. No se modifica SQL historico de Dashboard ni snapshots de `daily_business_closures`. Solo se conecta el saldo Por pagar actual con la misma fuente de comisiones utilizada por ambas interfaces.

### 20. Stock

No se crea otra reserva ni otro descuento. Guardado y transiciones delegan en el nucleo actual. Paso entre estados reservados conserva reserva; entrega consume; cancelacion libera; devolucion repone mediante funciones existentes. Las restricciones/indices de movimientos canonicos se conservan. La prueba de concurrencia real y de ingreso/descuento exactamente una vez requiere la migracion aplicada y sigue pendiente.

### 21. Seguridad

Rutas nuevas envueltas en `Admin`; no se cambia autenticacion. RPC administrativas validan `auth.uid()` e `is_admin()`. RPC propias validan perfil reseller activo y filtran por `auth.uid()`; no aceptan otro usuario arbitrariamente. SECURITY DEFINER: owner postgres, `search_path = ''`, esquemas explicitos, REVOKE publico/anon y EXECUTE solo authenticated en entradas autorizadas. Triggers/helpers internos sin EXECUTE del cliente.

Se retiran las policies `Resellers can read own sales` y `Resellers can read own commission payments`: una policy de fila no oculta costos ni `financial_account_id`. Las policies Admin se conservan. El frontend reseller usa RPC sanitizadas, no SELECT * sobre esas tablas. La vista legacy `reseller_sales`, security_invoker, deja de habilitar acceso directo reseller; no es consumida por el frontend actual. No se modifican policies retail, auth, Storage o Edge Functions. Policies adicionales creadas solo en produccion: **No confirmado**, requieren comprobarse antes de aplicar.

### 22. RPC nuevas/modificadas

Nuevas entradas: `admin_set_collection_defaults(uuid,uuid)`, `admin_manage_account_v2(uuid,text,text,text)`, `admin_save_sale_v2(uuid,jsonb)`, `admin_operate_sale_v2(uuid,text,text,boolean)`, `admin_search_sale_products_v2(text)`, `admin_cash_day_v2(date)`, `get_my_commission_balances_v2()`, `admin_commission_balances_v2()`, `get_commission_sales_v2(uuid,text,integer)`, `get_my_payment_receipts_v2(uuid,integer)`, `get_my_operation_sales_v2(date,date,text,text,integer,integer,uuid)`, `get_my_operation_home_v2()`.

Helpers nuevos: `guard_financial_account_v2()` (trigger), `commission_sale_states_v2(uuid)` y `commission_balances_v2(uuid)` (privados). Modificada en la NUEVA migracion: `mark_commission_payment_paid(uuid,date,text,text,text,text,uuid)`, misma firma/retorno, para neto cero y no actualizar movimientos inmutables en conflicto.

### 23. Migracion SQL

`supabase/20260908_daily_operations_reseller_finance_v2.sql`. **NO ejecutada.** Una transaccion BEGIN/COMMIT, sin tablas nuevas. Agrega tres columnas de ventas y dos FK de defaults, dos indices operativos, constraint de efectivo no negativo, dos triggers de guardas financieras y funciones/grants anteriores. Notifica refresco de schema al confirmar.

Backfill solo de fechas de pedidos abiertos: toma `created_at` convertido a Asuncion. Mantiene los triggers deshabilitados UNICAMENTE durante ese UPDATE bajo bloqueo exclusivo; restaura los modos originales de triggers normales/always y no altera los previamente deshabilitados. Evita que el trigger legacy recalcule importes o rechace perfiles inactivos durante el backfill. Si falla, toda la transaccion, incluidos cambios de triggers, revierte. Diseno reejecutable como archivo completo despues de una aplicacion completa; no ejecutar fragmentos. Requiere rol propietario/postgres y las macrofases previas/V2.1. Tomar respaldo y usar ventana de mantenimiento por el bloqueo de `sales`.

### 24. Datos historicos

No se ejecutaron escrituras remotas. El SQL no recalcula ventas cerradas, comisiones pagadas, ledger ni stock historico. Pedidos abiertos reciben solo fecha operativa. Los historicos cerrados pueden conservar `operation_date = null`. No backfill de cuentas ni efectivo recibido. No se modifica ninguna migracion anterior.

### 25. Archivos creados

- `supabase/20260908_daily_operations_reseller_finance_v2.sql`
- `src/lib/operationApi.js`
- `src/lib/operationDates.js`
- `src/pages/admin/DailyOperations.jsx`
- `src/pages/admin/CommissionPayments.jsx`
- `src/pages/admin/dailyOperations.css`
- `src/pages/admin/saleOperations.css`
- `src/components/CommissionBalances.jsx`
- `src/components/operationUX.css`
- `tests/daily-operations-v2.test.mjs`
- `tests/operations-ui.mjs`
- `tests/operations-ui-fixtures.js`
- `OPERATION_COMMERCIAL_V2_REPORT.md`

### 26. Archivos modificados

- `src/App.jsx`
- `src/components/Layout.jsx`
- `src/components/ResellerUX.jsx`
- `src/lib/adminBusinessApi.js`
- `src/lib/adminCommissionsApi.js`
- `src/lib/resellerCommissionsApi.js`
- `src/lib/resellerExperienceApi.js`
- `src/lib/resellerSalesApi.js`
- `src/pages/admin/AdminDashboard.jsx`
- `src/pages/admin/CashAdmin.jsx`
- `src/pages/admin/CommissionPaymentDetail.jsx`
- `src/pages/admin/CommissionPaymentForm.jsx`
- `src/pages/admin/CommissionsAdmin.jsx`
- `src/pages/admin/FinanceAdmin.jsx`
- `src/pages/admin/SaleForm.jsx`
- `src/pages/panel/PanelHome.jsx`
- `src/pages/panel/PanelPaymentDetail.jsx`
- `src/pages/panel/PanelPayments.jsx`
- `src/pages/panel/PanelPerformance.jsx`
- `src/pages/panel/PanelSaleDetail.jsx`
- `src/pages/panel/PanelSales.jsx`
- `tests/business-ui-fixtures.js`
- `tests/business-ui.mjs`

Los dos ultimos solo actualizan la regresion visual previa a las RPC V3 y al mensaje de stock actualmente existente. No se cambio codigo de Storefront, paquetes, .env, Vercel, migraciones previas o Edge Functions.

### 27. Tests

- `node --test tests/*.test.mjs`: 33 aprobados, 0 fallos (15 nuevos). Incluye fechas, cambios de mes/ano, domingo, vuelto y WhatsApp; contratos estaticos de transacciones, permisos, proyecciones, cuentas, busqueda, caja y liquidaciones.
- `node tests/operations-ui.mjs`: 28 combinaciones pagina/tamano aprobadas; contacto, pasos operativos enviados a RPC, busqueda con debounce e imagen local y ausencia del input Horario; sin excepciones JS.
- `node tests/business-ui.mjs`: 18 combinaciones pagina/tamano aprobadas; Dashboard/metas/cierre y Storefront/carrito/revalidacion de stock; sin excepciones JS.
- `git diff --check`: sin errores de whitespace; solo avisos locales LF/CRLF.

**No probado contra Supabase:** compilacion/ejecucion SQL, permisos efectivos con JWT reales, concurrencia real, reservas, ledger, entrega, pago, devolucion y datos de Alba. Las pruebas de SQL aqui son contratos de codigo, NO ejecucion de PostgreSQL; las de UI usan transporte aislado, NO persistencia real.

### 28. Responsive

Admin Operacion/Nueva Venta/Finanzas/Caja: 1024, 1366, 1440, 1920 px. Panel Home/Ventas: 320, 360, 375, 390, 412, 430 px. Sin scroll horizontal de documento en esas pruebas. La tabla de items amplia tiene scroll interno, no expande el documento. Revisadas visualmente capturas de Home mobile y Operacion desktop. Las capturas temporales estan en `C:\Users\Usuario\AppData\Local\Temp\camaraza-operations-ui-QAIpJQ`. Los tests usan los componentes reales con shell/transporte de prueba; no verifican login real ni todas las paginas historicas.

### 29. Builds

`npm run build`: **CORRECTO**, Vite 6.4.3, 1722 modulos; entrada JS aproximadamente 428.06 kB / 124.03 kB gzip, paginas cargadas por chunks.

`npm run build:store`: **CORRECTO**, 1643 modulos; JS 436.11 kB / 126.34 kB gzip, CSS 19.44 kB / 4.57 kB gzip. No se instalaron dependencias.

### 30. Problemas encontrados

Corregidos: busqueda cargaba todo inventario; cobro sin cuenta preparada; no habia fecha operativa/contacto/vuelto persistentes; caja filtraba por UTC y muestra parcial de movimientos; saldo cero podia usar fallback incorrecto; cuentas sin acciones de archivo; saldo de comisiones dependia del filtro; lote automatico confundible con liquidacion; enlace de pagos inexistente; detalle reseller limitado a 100 ventas; consultas de pagos propios incluian columnas internas; fin de lote convertido a domingo UTC; egreso cero imposible ante compensacion total; tabla Nueva Venta desbordaba 1024 px; respuesta de settings ausente podia romper render. Fixtures antiguas de regresion actualizadas sin tocar Storefront.

Pendiente de comprobar: drift del schema/policies de produccion, permisos reales para suspender/restaurar triggers, volumen y duracion del bloqueo de backfill y funcionamiento real de funciones heredadas. Ninguno se declara probado por un build frontend.

### 31. Pasos manuales pendientes

1. Respaldar base y verificar que estan aplicadas las macrofases previas y Storefront V2.1; inspeccionar policies reales adicionales de `sales`/`commission_payments`.
2. Revisar el SQL completo; aplicarlo manualmente en entorno de prueba primero como postgres, en una sola transaccion. Luego repetir el proceso controlado en produccion cuando corresponda. No ejecutar solo partes del archivo.
3. Confirmar las RPC en schema cache y recargar la app. Configurar cuentas predeterminadas de efectivo/transferencia. Archivar TEST ITAU solo tras revisar saldo y caja abierta.
4. Probar venta directa 150000 + delivery 20000, paga con 200000: total170000, vuelto30000, comision0; contacto/despacho/entrega con un unico ingreso170000 y consumo correcto. Repetir transferencia.
5. Crear venta de reseller, entregarla, contrastar saldo propio/Admin (caso Alba), preparar liquidacion, confirmar y repetir confirmacion; revisar un unico egreso, ventas marcadas y ajustes. Probar devolucion antes/despues del pago y neto cero.
6. Probar dos sesiones admin concurrentes, cambio de fecha, domingo, ventas legacy, cuenta archivada, eliminacion con FK y permisos con anon/reseller A/reseller B/inactivo. Verificar que los GET directos de ventas y pagos no expongan datos privados.
7. Desplegar frontend solo despues de esas verificaciones y autorizacion. No se hizo deploy. Servidor local iniciado en `http://127.0.0.1:5176`; las funciones nuevas requieren migracion antes del uso real.

### 32. Veredicto

**Implementacion local completa y builds aprobados; lista para aplicacion controlada en pruebas y smoke test real, NO certificada en produccion.** En la lista siguiente SI significa implementado/revisado localmente, no ejecutado en Supabase. Todas las afirmaciones de stock, ledger, RLS y pagos requieren los pasos manuales anteriores para confirmacion operacional.

| Pregunta | Resultado local |
| --- | --- |
| Operacion de hoy implementada | SI |
| Solo 3 columnas principales | SI |
| operation_date independiente de created_at | SI |
| Cliente contactado persiste timestamp | SI, RPC implementada; persistencia real pendiente |
| WhatsApp rapido funciona | SI, enlace sin mensaje |
| Coordinado -> En camino | SI, delegacion implementada |
| En camino -> delivered_paid | SI, delegacion implementada |
| Entrega genera ingreso exactamente una vez | SI por nucleo/idempotencia existente; prueba real pendiente |
| Nueva Venta muestra imagenes | SI |
| Buscar drone devuelve coincidencias relacionadas | SI, coincidencias reales por campos/categoria; datos reales pendientes |
| Horario eliminado | SI, solo input |
| Notas mantenidas | SI |
| Efectivo usa predeterminada | SI |
| Transferencia permite cuenta bancaria | SI |
| Vuelto implementado | SI |
| Caja diaria V2 implementada | SI |
| Bancos sin apertura artificial | SI |
| Cuentas editables | SI, metadata segura |
| Cuenta con historial se archiva sin destruir ledger | SI, implementado; smoke pendiente |
| Cuenta sin uso puede eliminarse | SI, RPC/FK lo validan |
| TEST ITAU puede retirarse de operacion segura | SI, archivo manual; no se archivo automaticamente |
| Panel reseller muestra pedidos de hoy | SI |
| Semana actual/anterior implementadas | SI |
| Comision Admin/reseller misma fuente | SI |
| Disponible Alba coincide con Por pagar Admin | SI por fuente compartida; caso productivo NO verificado |
| Por confirmar | SI |
| En liquidacion | SI |
| Pagado | SI |
| Liquidaciones transparentes | SI |
| Domingo excluido de comision oficial | SI |
| Devoluciones conservan ajustes | SI, nucleo existente preservado |
| Dashboard sigue usando delivered_at | SI |
| Operacion usa operation_date | SI |
| Sin duplicar logica inventario | SI |
| RLS reseller correcto | SI en codigo revisado; policies reales NO verificadas |
| Admin sigue funcionando | SI en build/UI aislada; smoke autenticado pendiente |
| Storefront sigue funcionando | SI en build/UI aislada |
| npm run build correcto | SI |
| npm run build:store correcto | SI |
| Listo para ejecutar migracion y smoke test real | SI en entorno controlado con respaldo; no equivale a autorizar deploy |

**SQL ejecutado: NO. Commit: NO. Push: NO. Deploy: NO.**
