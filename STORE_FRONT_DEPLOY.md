# Camaraza Store - Storefront cliente final

## Builds

Reventa/Admin actual:

```bash
npm run build
```

Genera `dist/` usando `index.html` y `src/main.jsx`.

Cliente final:

```bash
npm run build:store
```

Genera `dist-store/` usando `storefront.html` y `src/storefront/main.jsx`.

## Segundo proyecto Vercel

1. Crear un proyecto nuevo en Vercel apuntando al mismo repositorio.
2. Configurar el build command como `npm run build:store`.
3. Configurar el output directory como `dist-store`.
4. Cargar las mismas variables publicas de Supabase que usa el proyecto actual:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WHATSAPP_NUMBER` si se usa como fallback.
5. Mantener `camarazareventa.com` en el deployment actual de reventa/admin.
6. Cuando se defina el dominio del cliente final, conectarlo al segundo proyecto Vercel.

## Datos compartidos

Ambos deployments usan el mismo Supabase y las mismas tablas de productos, imagenes e inventario.

El storefront cliente final consume RPCs publicas sanitizadas:

- `public.get_retail_catalog()`
- `public.get_retail_product(text)`
- `public.validate_retail_cart(jsonb)`

El catalogo de reventa consume RPCs sanitizadas separadas:

- `public.get_reseller_catalog()`
- `public.get_reseller_product(text)`

## Seguridad

El cliente final no tiene rutas de login, panel ni admin. La informacion interna no se lee desde React ni se devuelve desde las RPC retail: no se exponen costo, precio mayorista, comision, proveedor, SKU, stock reservado ni datos financieros.

Antes de desplegar el segundo dominio, ejecutar en Supabase la migracion:

```text
supabase/20260820_macro_phase_3_storefront_channels.sql
```

No incluir secretos reales en Vercel ni en este repositorio.
