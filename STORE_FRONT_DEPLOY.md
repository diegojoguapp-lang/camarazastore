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

Genera `dist-store/index.html` usando `storefront.html` y `src/storefront/main.jsx`.
El plugin `retail-root-entry` de `vite.store.config.js` renombra la entrada compilada.
La raiz `/` sirve la tienda; no hay que visitar `/storefront.html`.
Los estilos retail estan en `src/storefront/storefront.css`, separados del Admin.

## Segundo proyecto Vercel

1. En Vercel: Add New > Project > importar el MISMO repositorio actual como un segundo proyecto.
2. Root Directory: raiz de este repositorio (no la subcarpeta legacy `camaraza-store/`). Framework Preset: Vite.
3. En Build and Output Settings, activar Override: Build Command `npm run build:store`; Output Directory `dist-store`.
4. Install Command: `npm ci`. No usar `npm run build` para el segundo proyecto.
5. Cargar las mismas variables publicas de Supabase que usa el proyecto actual para los entornos Preview y Production:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WHATSAPP_NUMBER` si se usa como fallback.
6. Mantener `camarazareventa.com` en el deployment actual de reventa/admin.
7. El `vercel.json` existente reescribe rutas hacia `/index.html`; no requiere cambios. La entrada ahora existe en el output retail.
8. Cuando se autorice el deployment, comprobar en Preview `/` y abrir/recargar `/producto/<slug-real>` directamente.
9. En Settings > Domains del segundo proyecto, agregar `camarazastore.com` y opcionalmente `www.camarazastore.com`.
10. Aplicar en el proveedor DNS los registros que Vercel indique para ese proyecto. No copiar valores DNS de ejemplos ni mover el dominio de Reventa.
11. Probar productos publicados, precios minoristas, carrito persistente, agotados, precio cambiado y WhatsApp en celular antes de usar el dominio definitivo.

No se realizo ninguna de estas acciones remotas. Esta documentacion es preparatoria.
Referencia oficial: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## Prueba local

```powershell
npm run build:store
npx --no-install vite preview --config vite.store.config.js --host 127.0.0.1 --port 4174
```

Abrir `http://127.0.0.1:4174/`. Para desarrollo:

```powershell
npx --no-install vite --config vite.store.config.js --host 127.0.0.1 --port 5174
```

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

El cliente final no tiene rutas de login, panel ni admin. Las RPC retail no devuelven costo, precio mayorista, comision, proveedor, SKU, stock reservado ni datos financieros.
La clave anon es publica: NO identifica un dominio. El catalogo de reventa sigue siendo publico y sus RPC pueden ser consultadas desde cualquier cliente anon. Separar deployments no convierte precios mayoristas ya publicos en secretos. Esta fase no cambia esa regla existente.

Antes de desplegar el segundo dominio, ejecutar en Supabase la migracion:

```text
supabase/20260820_macro_phase_3_storefront_channels.sql
```

La nueva macrofase requiere ademas `supabase/20260906_business_goals_daily_operations.sql`, despues de todas las migraciones anteriores. Debe ser revisada y ejecutada manualmente ANTES de publicar el frontend Admin nuevo. No se ejecuto aqui.

Solo variables `VITE_*` publicas indicadas arriba; jamas service role, contrasenas o claves privadas en frontend. No se modifico `.env`.

## Carrito y WhatsApp

El carrito usa localStorage. No crea pedidos ni reserva stock. Cada compra valida publicacion, precio y disponibilidad actual mediante `validate_retail_cart`. Si falta un producto, se agoto, cambio el precio o bajo el stock, requiere revision antes de abrir WhatsApp. Un error de red bloquea el envio.
El total usa precios minoristas revalidados. WhatsApp se resuelve desde `social_links` (`network = 'whatsapp'`), con `VITE_WHATSAPP_NUMBER` como fallback existente. El enlace abre en la misma pestaña para evitar bloqueos de ventanas despues de una llamada asincrona.
El stock puede cambiar despues de esta validacion: WhatsApp NO es una reserva ni una venta confirmada.
