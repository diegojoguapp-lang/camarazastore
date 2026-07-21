# Fase 2 - Cuentas de revendedores

Esta fase agrega gestion administrativa de revendedores sin implementar ventas, comisiones, clientes, pagos, entregas, inventario ni finanzas.

## Archivos SQL

Ejecutar en este orden:

1. Confirmar que ya fue ejecutado:

   `supabase/20260720_phase_1_profiles_roles.sql`

2. Ejecutar:

   `supabase/20260720_phase_2_reseller_accounts.sql`

La migracion de Fase 2:

- Agrega `profiles.email`.
- Crea indice unique para `lower(email)` cuando email no es null.
- Crea `public.reseller_code_seq`.
- Crea `public.next_reseller_code()`.
- Inicializa la sequence segun codigos `REV-0001` existentes.
- Restringe la funcion y sequence para que no sean ejecutables por `anon` ni `authenticated`.

## Edge Functions

Funciones creadas:

- `supabase/functions/create-reseller/index.ts`
- `supabase/functions/manage-reseller/index.ts`

`create-reseller`:

- Acepta solo `POST`.
- Valida Bearer token del admin.
- Confirma `profiles.role = admin` e `is_active = true`.
- Crea usuario en Supabase Auth con Admin API.
- Genera codigo `REV-0001` usando `public.next_reseller_code()`.
- Inserta `profiles` con `role = reseller`.
- Si falla `profiles`, elimina el Auth user recien creado.

`manage-reseller`:

- Acepta solo `POST`.
- Valida Bearer token del admin.
- Restablece contrasena temporal de un reseller.
- Activa/desactiva `profiles.is_active`.
- Banea/desbanea el Auth user con Admin API.
- No elimina revendedores.

## Secretos de Supabase Functions

Configurar secretos, nunca variables `VITE_`:

```bash
supabase secrets set SUPABASE_URL="https://TU-PROYECTO.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
supabase secrets set ALLOWED_ORIGIN="https://camarazareventa.com,http://localhost:5173"
```

No mostrar ni pegar el valor real de `SUPABASE_SERVICE_ROLE_KEY` en documentacion, consola publica, commits ni frontend.

## Comandos de despliegue

Desde la raiz del proyecto:

```bash
supabase functions deploy create-reseller
supabase functions deploy manage-reseller
```

Si el CLI pide proyecto:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy create-reseller
supabase functions deploy manage-reseller
```

## Comprobar funciones desplegadas

```bash
supabase functions list
```

Tambien se puede revisar en Supabase Dashboard:

1. Ir a Edge Functions.
2. Confirmar que existen `create-reseller` y `manage-reseller`.
3. Confirmar que tienen secretos configurados.

## Crear el primer revendedor

1. Entrar como admin a `/login`.
2. Ir a `/admin/revendedores`.
3. Completar:
   - Nombre completo.
   - Correo electronico.
   - Contrasena temporal.
   - Confirmar contrasena.
   - Telefono.
   - Ciudad.
4. Presionar `Crear revendedor`.
5. Confirmar que aparece tarjeta:
   - Codigo.
   - Nombre.
   - Correo.
   - Contrasena temporal.
6. Presionar `Copiar credenciales`.
7. Entregar credenciales al revendedor por un canal seguro.

La contrasena temporal no se guarda en `profiles`.

## Probar acceso del revendedor

1. Abrir `/login`.
2. Ingresar correo y contrasena temporal.
3. Confirmar redireccion a `/panel`.
4. Confirmar que se ve:
   - Nombre.
   - Codigo de revendedor.
   - Correo.
   - Estado de cuenta.
5. Cambiar contrasena desde seccion `Seguridad`.
6. Cerrar sesion.
7. Volver a entrar con la nueva contrasena.

## Probar bloqueo de admin para reseller

1. Iniciar sesion como revendedor.
2. Abrir `/admin`.
3. Resultado esperado:
   - No debe entrar al admin.
   - Debe mostrar acceso denegado o redireccion segun flujo.

## Restablecer contrasena

1. Entrar como admin.
2. Ir a `/admin/revendedores`.
3. En la fila del revendedor, presionar `Restablecer`.
4. Escribir nueva contrasena temporal.
5. Confirmar.
6. Entregar la nueva contrasena al revendedor.
7. El revendedor debe poder entrar con esa nueva contrasena.

## Desactivar/reactivar

Desactivar:

1. Entrar como admin.
2. Ir a `/admin/revendedores`.
3. Presionar `Desactivar`.
4. Confirmar.
5. El perfil queda `is_active = false`.
6. La Edge Function intenta banear el Auth user.

Reactivar:

1. Entrar como admin.
2. Ir a `/admin/revendedores`.
3. Presionar `Reactivar`.
4. Confirmar.
5. El perfil queda `is_active = true`.
6. La Edge Function intenta desbanear el Auth user.

## Pruebas RLS y seguridad

Verificar:

- Admin lee todos los perfiles.
- Reseller lee solo su perfil.
- Reseller no inserta perfiles.
- Reseller no actualiza `role`.
- Reseller no actualiza `is_active`.
- Reseller no crea usuarios Auth.
- No hay llamadas Admin API en React.
- `SUPABASE_SERVICE_ROLE_KEY` solo existe como secreto de Edge Functions.
- No hay registro publico.
- No se guardan contrasenas en `profiles`.

## Rollback

Frontend:

- Revertir cambios de esta fase en git.

Edge Functions:

```bash
supabase functions delete create-reseller
supabase functions delete manage-reseller
```

SQL, si aun no hay revendedores reales:

```sql
begin;
drop function if exists public.next_reseller_code();
drop sequence if exists public.reseller_code_seq;
drop index if exists public.profiles_email_unique_idx;
alter table public.profiles drop column if exists email;
notify pgrst, 'reload schema';
commit;
```

Si ya hay revendedores reales, no borrar `profiles.email` ni codigos sin backup.

## Riesgos pendientes

- La app depende de que Fase 1 y Fase 2 SQL esten ejecutadas antes del deploy frontend.
- Si `ALLOWED_ORIGIN` no incluye el dominio correcto, las Edge Functions fallaran por CORS.
- Si se pierde la contrasena temporal mostrada al crear/restablecer, no se puede recuperarla; se debe generar una nueva.
- La creacion de usuarios depende del despliegue correcto de Edge Functions y secretos.
- No existe todavia auditoria historica de acciones admin.
