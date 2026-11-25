# Camaraza Store — instrucciones de trabajo QA

- Coordinar por especialidad: CTO, backend, frontend, seguridad, QA, rendimiento, DevOps y auditoría independiente.
- Usar subagentes reales solo cuando estén disponibles. Registrar quién ejecutó y quién revisó; no simular independencia.
- Trabajar únicamente en una rama aislada y entornos de prueba autorizados. Verificar la identidad exacta de cada destino con el registro privado del propietario antes de operar.
- No modificar main, producción, despliegues comerciales, ni usar datos reales de clientes. No publicar credenciales, identificadores privados, información personal, registros sin filtrar ni hallazgos de seguridad explotables.
- No desactivar RLS, no aplicar permisos amplios y no omitir controles. Las funciones privilegiadas requieren revisión de autorización y pruebas negativas.
- No ejecutar despliegues automáticos desde esta rama. No abrir ni fusionar PR a main sin autorización específica.
- Antes de cambiar código, leer las instrucciones y archivos existentes. Aislar los cambios de agentes, fijar un responsable por archivo, preservar trabajo ajeno y revisar el diff.
- Cada prueba debe registrar esperado, obtenido, entorno, evidencia y estado. Diferenciar revisión estática, prueba SQL, prueba API y prueba navegador. Una prueba con identidad SQL simulada no acredita autenticación real.
- Ejecutar pruebas reversibles con datos ficticios; documentar efectos no transaccionales como secuencias. No prometer ejecución asíncrona.
- Para publicación, exigir revisión independiente, regresión, seguridad y autorización del propietario. Los informes públicos son resúmenes sanitizados; evidencia interna y hallazgos sensibles se entregan por canal privado.

Consultar ROADMAP.md, TASKS.md, QA_REPORT.md, SECURITY_REPORT.md y CHANGELOG.md.
