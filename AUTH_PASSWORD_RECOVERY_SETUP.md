# Recuperacion y cambio de contrasena

Este documento explica el flujo de autenticacion y recuperacion de contrasena de Camaraza Store Re-venta.

## Archivos creados

- `src/pages/PasswordRecovery.jsx`
- `src/pages/UpdatePassword.jsx`
- `src/pages/admin/AdminSecurity.jsx`
- `AUTH_PASSWORD_RECOVERY_SETUP.md`

## Archivos modificados

- `src/App.jsx`
- `src/components/Layout.jsx`
- `src/lib/roles.js`
- `src/pages/Login.jsx`
- `src/pages/panel/PanelHome.jsx`

## Rutas nuevas

- `/recuperar-contrasena`
- `/actualizar-contrasena`
- `/admin/seguridad`

Rutas verificadas:

- `/login`
- `/panel`
- `/admin`

## Configurar URLs En Supabase

Entrar a Supabase Dashboard:

1. Authentication.
2. URL Configuration.
3. Configurar:

Site URL:

```text
https://camarazareventa.com
```

Redirect URLs:

```text
https://camarazareventa.com/**
https://*.vercel.app/**
http://localhost:5173/**
```

Importante:

- No usar `localhost:3000`.
- Un correo enviado antes de corregir estas URLs puede seguir apuntando a localhost. Descartar ese correo y solicitar uno nuevo.
- El frontend usa `window.location.origin`, por eso funciona en produccion, previews de Vercel y localhost.

## Como funciona la recuperacion

1. Usuario abre `/recuperar-contrasena`.
2. Escribe su correo.
3. La app llama:

```js
supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/actualizar-contrasena`
})
```

4. La pantalla siempre muestra:

```text
Si el correo esta registrado, recibiras un enlace para cambiar tu contrasena.
```

5. El usuario abre el enlace del correo.
6. Supabase crea una sesion temporal de recovery.
7. `/actualizar-contrasena` permite guardar una nueva contrasena con:

```js
supabase.auth.updateUser({ password })
```

8. La app cierra la sesion temporal y redirige a `/login`.

## Probar recuperacion del admin

1. Abrir `/recuperar-contrasena`.
2. Usar el correo del admin real:

```text
diegojoguapp@gmail.com
```

3. Abrir el correo recibido.
4. Confirmar que abre `/actualizar-contrasena`.
5. Guardar nueva contrasena.
6. Confirmar mensaje:

```text
Tu contrasena fue actualizada correctamente. Ya podes iniciar sesion.
```

7. Iniciar sesion.
8. Confirmar redireccion a `/admin`.

## Probar recuperacion de un reseller

1. Crear o usar un revendedor existente.
2. Abrir `/recuperar-contrasena`.
3. Escribir su correo.
4. Abrir enlace del correo.
5. Definir nueva contrasena.
6. Iniciar sesion.
7. Confirmar redireccion a `/panel`.
8. Confirmar que no puede entrar a `/admin`.

## Probar enlace vencido

1. Usar dos veces el mismo enlace de recovery, o esperar a que venza.
2. Abrirlo.
3. Resultado esperado:

```text
Este enlace vencio o ya fue utilizado. Solicita uno nuevo.
```

4. Usar el boton `Solicitar un nuevo enlace`.

## Cambiar contrasena desde /panel

1. Iniciar sesion como reseller.
2. Abrir `/panel`.
3. Ir a `Seguridad`.
4. Escribir nueva contrasena.
5. Confirmar nueva contrasena.
6. Presionar `Cambiar contrasena`.
7. Confirmar mensaje de exito.

No se modifica el correo ni el rol.

## Cambiar contrasena desde /admin/seguridad

1. Iniciar sesion como admin.
2. Abrir `/admin/seguridad`.
3. Escribir nueva contrasena.
4. Confirmarla.
5. Presionar `Cambiar contrasena`.

Esta accion usa la sesion normal del admin y no usa `service_role`.

## Restablecer temporalmente la contrasena de un reseller

1. Iniciar sesion como admin.
2. Abrir `/admin/revendedores`.
3. Presionar `Restablecer`.
4. Escribir una nueva contrasena temporal.
5. Confirmar.
6. Entregar esa contrasena al revendedor por canal seguro.

La Edge Function `manage-reseller` no devuelve la contrasena y no la guarda en tablas.

## Riesgos

- Si Supabase URL Configuration sigue apuntando a localhost, los correos nuevos pueden abrir URLs incorrectas.
- Los correos enviados antes de corregir URLs deben descartarse.
- La recuperacion depende de que Supabase Auth pueda enviar correos.
- Si un usuario esta desactivado en `profiles`, aunque cambie su contrasena no debe poder entrar al panel.
- No existe cierre global de otras sesiones desde el frontend en esta fase.

## Rollback

Frontend:

- Revertir los archivos creados y modificados en esta fase.

Supabase:

- No se ejecutaron migraciones para este flujo.
- Si se modifico URL Configuration, volver manualmente a la configuracion anterior solo si es estrictamente necesario.

## Casos de prueba

- Admin solicita recuperacion.
- Admin abre enlace y define nueva contrasena.
- Admin inicia sesion y entra a `/admin`.
- Reseller solicita recuperacion.
- Reseller abre enlace y define nueva contrasena.
- Reseller inicia sesion y entra a `/panel`.
- Reseller no entra a `/admin`.
- Enlace vencido muestra mensaje claro.
- Usuario desactivado no accede.
- Admin cambia su propia contrasena desde `/admin/seguridad`.
- Reseller cambia su propia contrasena desde `/panel`.
- Admin restablece contrasena temporal de reseller desde `/admin/revendedores`.
- No existe registro publico.
- No se guardan contrasenas en tablas.
- No se imprimen tokens ni contrasenas en consola.
