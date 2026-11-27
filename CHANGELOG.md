# Changelog — rama QA

## 2026-11-25 — ciclo 01

### Entorno de pruebas
- Revalidado esquema y versión desplegada.
- Ajustados permisos específicos de operaciones ya existentes y verificada la restricción de acceso anónimo.
- Probada venta directa V2 completa con rollback, incluyendo reintento de entrega y devolución.
- Verificada la restauración del estado comercial inicial después de la prueba.

### Repositorio
- Documentación de instrucciones, roadmap, tareas y resultados QA.
- Exclusión de despliegues automáticos para esta rama, manteniendo la configuración existente de rutas.

Sin modificaciones a main ni producción. Los permisos aplicados en el entorno de pruebas aún deben conciliarse con una migración revisada y reproducible. No se ha realizado una auditoría independiente.

## 2026-11-25 — ciclo 02

- Pruebas reversibles de compras, controles de inventario, gastos, transferencias y caja.
- Verificación posterior de limpieza y stock original.
- Registro de decisión comercial pendiente sobre disponibilidad de fondos.
- Sin cambios de lógica comercial ni despliegues; solo documentación QA.


## 2026-11-25 — continuación del ciclo 02

- Corregido el desbordamiento del orden de galería al agregar imágenes en edición de productos, preservando órdenes existentes y contemplando valores nulos.
- Agregadas ocho pruebas de regresión del API con transporte simulado; total local 44/44, ambas compilaciones aprobadas.
- Revalidado el estado comercial original y comprobada la ausencia de buckets y revendedores QA en el entorno autorizado.
- Registrados bloqueos de lint, permisos de detalle de comisiones y acceso web al alojamiento.
- Revisión independiente parcial de frontend y seguridad ejecutada por agentes reales.
- Sin despliegues, ampliación de permisos ni cambios persistentes de base de datos. La política comercial de saldos negativos no cambia.

## 2026-11-27 — cuentas oficiales y aislamiento por API

- Verificadas las dos cuentas ficticias creadas por el propietario mediante el formulario administrativo de Staging.
- Creados los dos buckets públicos desde el Dashboard oficial, limitados a JPEG/PNG/WebP y 5 MB; aún sin objetos.
- Conciliado y versionado el permiso exacto del detalle de comisiones con revisión independiente; helpers y acceso anónimo siguen restringidos.
- Agregado ejecutor opt-in de Auth y API real con credenciales stdin, clave publicable, identidad fija de Staging y sesiones en memoria.
- Aprobadas 20 comprobaciones API, matriz SQL reversible y 44 pruebas locales. Retirados fixtures propios y cerradas las sesiones del ejecutor.
- Sin despliegues ni modificaciones de main/producción. Carga de imágenes, UI reseller, comisiones completas y pruebas de carga siguen pendientes.

## 2026-11-27 — banco, ciclo de comisión y regresión

- Restauradas solo las escrituras bancarias previstas por la aplicación, reforzadas con propietario activo; migración aplicada exclusivamente en Staging y revisada independientemente.
- Aprobadas 26 comprobaciones bancarias API, 8 comprobaciones Storage y 8 grupos SQL reversibles de comisiones. Datos de prueba limpiados y sesiones cerradas.
- Ejecutores opt-in con destino fijado a Staging, credenciales stdin y salida filtrada; PNG sintético versionado para pruebas.
- Corregida la aceptación de URLs ajenas en limpieza de recursos retail, con ocho pruebas locales nuevas. No se desplegó el frontend.
- Configurado ESLint9 con dependencia fijada y corregidos los errores existentes; quedan 16 advertencias de hooks. Regresión 52/52 y builds aprobados.
- Registradas dos muestras acotadas de lecturas; picos de API requieren investigación, sin afirmar capacidad de producción.


## 2026-11-27 — verificación positiva de imágenes

- Verificadas cargas administrativas reales del PNG sintético en ambos buckets, persistencia y visualización pública en el catálogo de reventa.
- Restaurada la referencia de imagen del producto; confirmado archivo huérfano tras quitarla y retirado desde Dashboard.
- Verificada eliminación automática del archivo al quitar la imagen de una categoría y guardar; Storage vacío.
- El registro ficticio de categoría sin imagen sigue pendiente de retiro, por bloqueo del diálogo nativo en el control de Chrome. Sin despliegues ni cambios de main/producción.


## 2026-11-27 — cierre de limpieza de imágenes
- Confirmado por SQL el retiro manual de la categoría ficticia; cero categorías y objetos restantes. Stock 10/0/10 y cuentas QA preservadas.

- Preparada limpieza acotada de imagen principal posterior al guardado, con conservación de referencias compartidas reconocidas y advertencia cuando el borrado no se confirma. No desplegada.
- Documentada propuesta exploratoria de política y 20 casos de expresión SQL; sin aplicar permisos ni migraciones nuevas.

- Regresión ampliada a 65 pruebas aprobadas; 13 casos de limpieza repetidos por revisor independiente. Lint 0 errores/16 advertencias existentes y build administrativo aprobado.
