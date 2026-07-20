# Fase 1 - Perfiles, roles y acceso seguro

Esta fase prepara Camaraza Store Re-venta para futuros revendedores sin implementar ventas, comisiones, pagos, finanzas, clientes ni inventario avanzado.

## Archivos creados

- `supabase/20260720_phase_1_profiles_roles.sql`
- `src/lib/roles.js`
- `src/pages/panel/PanelHome.jsx`
- `PHASE_1_ROLES_SETUP.md`

## Archivos modificados

- `src/App.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/pages/Login.jsx`
- `src/pages/Home.jsx`
- `src/styles/main.css`

## Arquitectura aplicada

La autenticacion sigue usando Supabase Auth con email y contrasena. La diferencia es que ahora el frontend activo valida tambien una fila en `public.profiles`.

Roles admitidos:

- `admin`
- `reseller`

Reglas de acceso:

- Sin sesion: redireccion a `/login`.
- `admin` activo: puede entrar a `/admin`.
- `reseller` activo: puede entrar a `/panel`.
- Usuario sin perfil: acceso rechazado.
- Perfil inactivo: acceso rechazado.

La seguridad real queda preparada en Supabase con RLS. React solo mejora la experiencia de navegacion; no debe ser la barrera principal.

## Migracion SQL

Nombre exacto:

`supabase/20260720_phase_1_profiles_roles.sql`

La migracion:

- Crea `public.profiles`.
- Activa RLS.
- Inserta/actualiza el admin actual:
  - `id`: `baad9301-c830-4640-82cc-d6a311ab964b`
  - `role`: `admin`
  - `full_name`: `Diego Camaraza`
  - `is_active`: `true`
- Crea `public.is_admin()`.
- Crea `public.current_profile_role()`.
- Reemplaza politicas amplias de `authenticated` por politicas basadas en `public.is_admin()`.
- Mantiene lectura publica de productos activos, imagenes publicas, videos visibles y redes sociales.
- No modifica datos de productos, imagenes, videos ni redes.

## Como ejecutar manualmente en Supabase

1. Hacer backup o export de las tablas actuales:
   - `products`
   - `product_images`
   - `help_videos`
   - `social_links`

2. Confirmar que existe el usuario Auth:
   - Email: `diegocamarasa@gmail.com`
   - UUID: `baad9301-c830-4640-82cc-d6a311ab964b`

3. Abrir Supabase Dashboard.

4. Ir a SQL Editor.

5. Copiar el contenido completo de:

   `supabase/20260720_phase_1_profiles_roles.sql`

6. Ejecutar el SQL una sola vez.

7. Esperar unos segundos por el refresco del schema cache. La migracion incluye:

   `notify pgrst, 'reload schema';`

8. Recargar la aplicacion.

9. Probar login con el usuario admin.

## Pruebas recomendadas

Visitante publico:

- Puede abrir `/`.
- Puede abrir `/catalogo`.
- Puede abrir `/producto/:slug`.
- Puede abrir `/ayuda`.
- Puede abrir `/redes`.
- No puede abrir `/admin`.
- No puede abrir `/panel`.

Administrador:

- Inicia sesion desde `/login`.
- Es enviado a `/admin`.
- Puede listar productos.
- Puede crear/editar productos.
- Puede administrar videos.
- Puede administrar redes.
- No es enviado a `/panel`.

Futuro revendedor:

- Inicia sesion desde `/login`.
- Es enviado a `/panel`.
- Ve el placeholder del panel.
- No puede entrar a `/admin`.
- No puede escribir en `products`, `product_images`, `help_videos`, `social_links` ni `storage.objects`.

Usuario autenticado sin perfil:

- Inicia sesion.
- El frontend cierra sesion.
- Ve un error claro en `/login`.
- No entra a areas privadas.

Perfil inactivo:

- Inicia sesion.
- El frontend cierra sesion.
- Ve un error claro en `/login`.
- No entra a areas privadas.

## Como crear manualmente un futuro reseller

En esta fase no hay creacion de usuarios desde el frontend.

1. Ir a Supabase Dashboard.
2. Abrir Authentication > Users.
3. Crear el usuario con email y contrasena.
4. Copiar el UUID del usuario creado.
5. Ir a SQL Editor.
6. Insertar su perfil:

```sql
insert into public.profiles (
  id,
  reseller_code,
  role,
  full_name,
  phone,
  city,
  is_active,
  created_by
)
values (
  'UUID_DEL_USUARIO',
  'REV-001',
  'reseller',
  'Nombre del revendedor',
  '595...',
  'Ciudad',
  true,
  'baad9301-c830-4640-82cc-d6a311ab964b'
);
```

7. El revendedor entra por `/login` y debe ser enviado a `/panel`.

## Rollback

Antes de hacer rollback, confirmar si ya se crearon perfiles nuevos.

Rollback parcial recomendado si algo falla:

```sql
-- Restaurar permisos administrativos amplios temporalmente.
-- Usar solo como emergencia y volver a corregir RLS cuanto antes.

drop policy if exists "Admins can read all products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can delete products" on public.products;

create policy "Authenticated can read all products"
on public.products
for select
to authenticated
using (true);

create policy "Authenticated can insert products"
on public.products
for insert
to authenticated
with check (true);

create policy "Authenticated can update products"
on public.products
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated can delete products"
on public.products
for delete
to authenticated
using (true);
```

Rollback completo:

- Revertir el commit de esta fase en el frontend.
- Restaurar las politicas RLS anteriores desde backup o desde `supabase/schema.sql` y `supabase/admin_content.sql`.
- No borrar `profiles` si ya contiene usuarios reales, salvo que se haya confirmado que no se usara.

## Advertencias importantes

- No ejecutar la migracion sin backup.
- No usar `service_role` en el frontend.
- No agregar secretos en variables `VITE_*`.
- No habilitar registro publico.
- No crear usuarios desde el navegador en esta fase.
- Si existen otros usuarios autenticados que antes usaban el admin, necesitaran una fila en `profiles` con `role = 'admin'` e `is_active = true`.
- Si `help_videos` o `social_links` no existen aun en Supabase, primero ejecutar `supabase/admin_content.sql`.
- Si el bucket `product-images` no existe, primero ejecutar o revisar `supabase/schema.sql`.

## Pendiente para fases futuras

- Pantallas reales del panel revendedor.
- Ventas.
- Comisiones.
- Pagos.
- Finanzas.
- Clientes.
- Inventario avanzado.
- Creacion controlada de usuarios desde admin mediante backend seguro o Edge Function.
