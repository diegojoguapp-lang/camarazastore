# Roadmap de QA — Camaraza Store 3.0

## Etapa 1: preparación y control
- [x] Esquema de prueba restaurado y verificación estructural previa.
- [x] Compilación web de prueba y control de acceso.
- [x] Inicio de sesión administrativo de prueba comprobado.
- [x] Venta directa V2, reserva, cobro, reintento y devolución probados transaccionalmente.
- [ ] Revisar configuración de almacenamiento y crear contenedores de imágenes usando el servicio oficial.
- [ ] Completar matriz de permisos por operación y pruebas de separación de roles.

## Etapa 2: flujos de extremo a extremo
- Crear dos revendedores ficticios por el flujo oficial y confirmar aislamiento.
- Crear y editar producto, cargar imágenes, alta de cliente, compra, venta, caja, comisión, devolución, reportes y cierre de sesión.
- Probar concurrencia: últimas unidades, doble envío, cobro repetido, edición desactualizada.
- Verificar ambos entornos web (admin/reventa y minorista) sin contactar números reales.

## Etapa 3: calidad y rendimiento
- Automatizar pruebas de API y navegador en entorno autorizado, con fixtures exclusivamente ficticios.
- Verificar compilación y lint; capturar tiempos p50/p95, planes de consultas y pruebas con volúmenes representativos.
- Corregir defectos prioritarios, repetir regresiones y obtener revisión independiente.

## Etapa 4: revisión de entrega
- Documentar rollback, backup, migraciones y criterios de aceptación.
- No autorizar producción hasta que todos los bloqueos relevantes estén cerrados y exista autorización específica.

## Progreso ciclo 02
- [x] Compra, ingreso y pago con reintento secuencial.
- [x] Controles de stock negativo y reservado.
- [x] Gasto, anulación, transferencia y cierre de caja.
- [ ] Validar política de fondos disponibles.
- [ ] Repetir flujos desde navegador, con cuentas QA y concurrencia real.
