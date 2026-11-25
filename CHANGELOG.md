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
