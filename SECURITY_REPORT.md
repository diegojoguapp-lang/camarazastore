# Seguridad — resumen público del ciclo 01

Estado: revisión parcial; no aprobación de producción.

- RLS activo en las tablas comerciales comprobadas.
- Las pruebas SQL negativas para acceso anónimo y contexto sin identidad fueron satisfactorias.
- Permisos concedidos explícitamente solo para operaciones revisadas; las advertencias del asesor sobre funciones privilegiadas requieren auditoría funcional y pruebas de roles.
- El sitio de pruebas mantiene el control de acceso del alojamiento.
- Pendiente: verificar identidad, límites de autorización y aislamiento de dos revendedores reales de prueba, políticas de archivos, protección de contraseñas, revocación de sesiones y permisos de los procedimientos.
- Pendiente: revisar configuración, archivos versionados y límites de despliegue para evitar exponer entornos o datos.
- No guardar datos de clientes, contraseñas, tokens, claves privadas, archivos de entorno ni evidencia sensible en Git.
- Los hallazgos técnicos y recomendaciones detallados se gestionan privadamente con el propietario. No publicar información que permita explotar vulnerabilidades.
- Auditoría independiente: pendiente.

## Ciclo 02
- Controles de integridad de inventario y reintentos secuenciales financieros probados en SQL reversible.
- Limpieza comprobada; no se otorgaron nuevos permisos ni accesos.
- Pendientes aislamiento real entre revendedores, archivos, autenticación integral y auditoría independiente.


## Continuación del ciclo 02

- Revisión independiente parcial de código realizada por el agente `review_security`; no es auditoría integral ni certificación del entorno desplegado.
- Revisadas autorización de funciones, proyecciones de comisiones y políticas de archivos. Se comprobaron metadatos relevantes en Staging mediante solo lectura.
- Tres controles de identidad de comisiones rechazaron el contexto SQL authenticated sin identidad. No acredita autenticación real ni aislamiento entre dos usuarios.
- Pendientes pruebas de sesiones previas a desactivación, uniformidad de controles de cuenta activa, restricciones de imágenes y configuración de orígenes autorizados.
- Pendiente conciliación de permisos específicos del detalle de comisiones; se mantuvieron las restricciones existentes.
- Asesor de seguridad consultado: requiere revisión funcional de funciones privilegiadas y configuración de protección de contraseñas. Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable y https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- El navegador no obtuvo acceso al control del alojamiento. No se intentó eludir la protección ni se expusieron credenciales.
- Sin cambios de RLS, permisos, cuentas ni Storage durante esta continuación. Hallazgos detallados no publicados.

## Cuentas y API real — 2026-11-27

- Cuentas oficiales ficticias creadas por el propietario; validación de Auth y perfiles mediante sesiones reales separadas, con clave publicable y sin persistencia de tokens.
- Aislamiento de perfiles y filas bancarias ficticias distintas comprobado por API; acceso cruzado a comisiones y acceso a funciones administrativas/internas rechazados en ambas identidades.
- Restaurado solo el permiso específico del wrapper de detalle de comisiones, tras revisión independiente de sus controles de identidad/propiedad y pruebas negativas. Funciones internas y acceso anónimo permanecen restringidos. Migración registrada y versionada.
- Cuenta inactiva rechazada en SQL reversible; todavía no se verificó un JWT real previo a desactivación. No dar por resueltos los hallazgos de revocación anteriores.
- Buckets públicos limitados a imágenes JPEG/PNG/WebP de hasta 5 MB, exclusivamente catálogo ficticio. Carga, eliminación y negativas de archivos siguen pendientes.
- Las sesiones del ejecutor se cerraron; limpieza SQL confirmó cero sesiones QA y cero filas de fixture. No se tocaron las cuentas de prueba ni la sesión administrativa del navegador.
- Asesor consultado antes/después del permiso específico; advertencias previas y auditoría integral siguen pendientes. Sin credenciales en archivos, informes o Git.

## Continuación: banco y archivos — 2026-11-27

- Reparación bancaria revisada independientemente: permisos limitados a INSERT/UPDATE del API existente, con políticas de propietario activo antes de habilitar las operaciones. Administradores conservan sus controles; sin DELETE ni acceso anónimo.
- Auth/API real verificó separación de filas y bloqueo inmediato de una sesión existente al desactivar el perfil ficticio. Reactivación recuperó únicamente su acceso propio. No es una prueba de revocación del token de Auth.
- Se cerraron sesiones y retiraron filas de prueba; cero operaciones financieras persistentes y ambos perfiles ficticios activos al finalizar.
- Seis cargas PNG por revendedores/anónimo rechazadas en los dos buckets, con autenticación real. No prueba la carga positiva del administrador, ni validación funcional de MIME/tamaño bajo ese rol.
- Guard de limpieza de recursos restringido al origen y rutas propios, cubierto con ocho pruebas de transporte simulado. Implementación por `frontend_qa`, diff revisado por principal; aún no desplegado.
- Permisos y limpieza de archivos de productos siguen pendientes. No se ampliaron políticas de Storage como sustituto de pruebas.
- Advierten todavía los asesores previamente documentados y 16 avisos de hooks. No hay auditoría integral ni aprobación de producción. No se publican credenciales ni detalles explotables.
