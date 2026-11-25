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
