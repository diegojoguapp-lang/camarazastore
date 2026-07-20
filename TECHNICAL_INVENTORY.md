# Inventario tecnico - Camaraza Store Re-venta

Fecha de revision: 2026-07-20  
Alcance: inspeccion del repositorio local sin modificar logica, base de datos, dependencias, rutas ni configuracion sensible.

## 1. Estructura general del proyecto

### Framework y version

Proyecto React + Vite.

Versiones instaladas detectadas con `npm list --depth=0`:

- React: 18.3.1
- React DOM: 18.3.1
- Vite: 6.4.3
- @vitejs/plugin-react: 4.7.0
- react-router-dom: 7.18.0
- @supabase/supabase-js: 2.108.2
- lucide-react: 0.468.0

Versiones declaradas en `package.json`:

- React: ^18.3.1
- React DOM: ^18.3.1
- Vite: ^6.0.7
- @vitejs/plugin-react: ^4.3.4
- react-router-dom: ^7.1.1
- @supabase/supabase-js: ^2.47.10
- lucide-react: ^0.468.0

### Librerias principales

- `react` y `react-dom`: UI.
- `vite`: build/dev server.
- `react-router-dom`: rutas SPA.
- `@supabase/supabase-js`: auth, database y storage.
- `lucide-react`: iconos.
- `eslint`: linting declarado, aunque no se inspecciono config completa de lint.

### Estructura de carpetas

Raiz principal:

- `.env.example`: variables esperadas, sin valores reales.
- `index.html`: HTML de entrada.
- `package.json` / `package-lock.json`: dependencias y scripts.
- `vite.config.js`: configuracion Vite minima.
- `vercel.json`: rewrite SPA hacia `index.html`.
- `tailwind.config.js` y `src/index.css`: configuracion Tailwind presente.
- `src/`: aplicacion React activa.
- `public/`: assets publicos, placeholder e imagenes demo/miniaturas.
- `supabase/`: SQL de esquema y migraciones auxiliares.
- `supabase.sql`: esquema legacy.
- `dist/`: build generado previamente.
- `node_modules/`: dependencias instaladas.
- `camaraza-store/`: carpeta anidada con una copia parcial del proyecto. No parece ser la app activa desde la raiz actual.

Carpetas relevantes dentro de `src/`:

- `src/main.jsx`: punto de entrada React.
- `src/App.jsx`: definicion de rutas activas.
- `src/lib/`: Supabase, API y utilidades.
- `src/components/`: layouts, cards, UI, proteccion admin, toast.
- `src/pages/`: paginas publicas y login.
- `src/pages/admin/`: panel admin activo.
- `src/admin/`: componentes admin legacy/no conectados actualmente a `App.jsx`.
- `src/styles/main.css`: hoja de estilos activa importada desde `main.jsx`.
- `src/index.css`: estilos Tailwind presentes, pero no importados por `main.jsx`.

### Archivos de entrada

- `index.html` monta la app en `#root`.
- `src/main.jsx` renderiza `<App />` dentro de `React.StrictMode`.
- `src/main.jsx` importa `./styles/main.css`, por lo que esa es la hoja CSS activa.
- `src/index.css` no se importa actualmente desde `main.jsx`.

### Sistema de rutas activo

Definido en `src/App.jsx` con `BrowserRouter`, `Routes` y `Route`.

Rutas publicas:

- `/` -> `Home`
- `/reventa` -> `Reventa`, dentro de `Layout`
- `/catalogo` -> `Catalogo`, dentro de `Layout`
- `/producto/:slug` -> `ProductDetail`, dentro de `Layout`
- `/materiales` -> `Materiales`, dentro de `Layout`
- `/ayuda` -> `Ayuda`, dentro de `Layout`
- `/reglas` -> `Reglas`, dentro de `Layout`
- `/redes` -> `Redes`, dentro de `Layout`
- `/login` -> `Login`, dentro de `Layout`
- `*` -> pagina no encontrada, dentro de `Layout`

Rutas privadas:

- `/admin` -> `AdminDashboard`, envuelto en `ProtectedRoute` y `AdminLayout`
- `/admin/productos` -> `ProductList`, envuelto en `ProtectedRoute` y `AdminLayout`
- `/admin/productos/nuevo` -> `ProductForm`, envuelto en `ProtectedRoute` y `AdminLayout`
- `/admin/productos/:id/editar` -> `ProductForm`, envuelto en `ProtectedRoute` y `AdminLayout`
- `/admin/videos` -> `HelpVideosAdmin`, envuelto en `ProtectedRoute` y `AdminLayout`
- `/admin/redes` -> `SocialLinksAdmin`, envuelto en `ProtectedRoute` y `AdminLayout`

### Componentes y paginas existentes

Componentes activos:

- `src/components/Layout.jsx`
  - `Layout`: layout publico.
  - `AdminLayout`: layout admin activo.
- `src/components/ProtectedRoute.jsx`
  - Valida sesion de Supabase antes de permitir acceso admin.
- `src/components/ProductCard.jsx`
  - Tarjeta de producto en catalogo.
- `src/components/StatCard.jsx`
  - Tarjeta de estadistica para dashboard admin.
- `src/components/ui.jsx`
  - `StatusBadge` y `Spinner`, usados por componentes legacy/no activos.
- `src/components/Toast.jsx`
  - Provider/hook de toast, usado por componentes legacy/no activos.
- `src/components/PublicLayout.jsx`
  - Layout publico legacy/no conectado en `App.jsx`.

Paginas activas:

- `src/pages/Home.jsx`
- `src/pages/Reventa.jsx`
- `src/pages/Catalogo.jsx`
- `src/pages/ProductDetail.jsx`
- `src/pages/Materiales.jsx`
- `src/pages/Ayuda.jsx`
- `src/pages/Reglas.jsx`
- `src/pages/Redes.jsx`
- `src/pages/Login.jsx`
- `src/pages/admin/AdminDashboard.jsx`
- `src/pages/admin/ProductList.jsx`
- `src/pages/admin/ProductForm.jsx`
- `src/pages/admin/HelpVideosAdmin.jsx`
- `src/pages/admin/SocialLinksAdmin.jsx`

Codigo legacy/no activo detectado:

- `src/pages/Producto.jsx`: no esta registrado en `App.jsx`; importa funciones que no existen actualmente en `src/lib/api.js` (`getProductoBySlug`) y utilidades no existentes con esos nombres (`ganancia`, `waLink`, `mensajeConsultaStock`, `copiar`).
- `src/admin/*`: no esta registrado en `App.jsx`; importa API antigua inexistente o incompatible (`getAllProducts`, `addProductImage`, `deleteProductImage`) y depende de `AuthProvider`, que no se monta en `main.jsx`.
- Carpeta anidada `camaraza-store/`: parece copia parcial y no parece ser la aplicacion que se ejecuta desde la raiz.

## 2. Autenticacion

### Supabase Auth

Si existe Supabase Auth.

Archivos relacionados:

- `src/lib/supabase.js`: crea el cliente Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- `src/pages/Login.jsx`: usa `supabase.auth.signInWithPassword`.
- `src/components/ProtectedRoute.jsx`: usa `supabase.auth.getSession` y `supabase.auth.onAuthStateChange`.
- `src/components/Layout.jsx`: el `AdminLayout` usa `supabase.auth.signOut`.
- `src/lib/auth.jsx`: context provider alternativo, pero no esta montado en `main.jsx` ni usado por las rutas activas.

### Como funciona actualmente el acceso al admin

1. El usuario entra a `/login`.
2. `src/pages/Login.jsx` valida que Supabase este configurado.
3. Hace login con `supabase.auth.signInWithPassword({ email, password })`.
4. Si el login es correcto, navega a `/admin`.
5. Las rutas `/admin/*` estan envueltas por `ProtectedRoute`.
6. `ProtectedRoute` consulta `supabase.auth.getSession`.
7. Si no hay sesion, redirige a `/login`.
8. Si hay sesion, renderiza el panel admin.

### Donde se valida la sesion

- Validacion activa: `src/components/ProtectedRoute.jsx`.
- Login activo: `src/pages/Login.jsx`.
- Logout activo: `AdminLayout` en `src/components/Layout.jsx`.

### Roles

No se detectan roles en el frontend activo.

No se detectan campos de rol, claims custom, tabla de perfiles o validacion por `user_metadata`/`app_metadata` en el codigo activo.

Las politicas SQL detectadas permiten administracion a cualquier usuario con rol Supabase `authenticated`.

### Riesgos de seguridad

- El admin esta protegido por sesion real de Supabase, no solo oculto visualmente.
- Pero no hay distincion entre `admin` y otros usuarios autenticados.
- Si en el futuro se crean usuarios revendedores con Supabase Auth, con las politicas actuales podrian quedar habilitados para leer/escribir/eliminar productos, videos, redes y storage, salvo que se cambie RLS antes.
- Las politicas actuales de escritura usan `to authenticated` o `auth.role() = 'authenticated'`, lo cual es amplio.
- `ProtectedRoute` solo valida sesion, no rol.
- No hay tabla `profiles`, `user_roles` o equivalente visible.
- No hay server-side backend propio; la seguridad depende de RLS en Supabase.
- Si `VITE_SUPABASE_ANON_KEY` tiene acceso a tablas sin RLS correcto, el riesgo seria alto.

### Confirmacion sobre proteccion del admin

El admin esta protegido realmente contra usuarios no autenticados mediante Supabase Auth y `ProtectedRoute`.

No esta protegido por rol admin; esta protegido por "cualquier sesion autenticada".

## 3. Supabase

### Cliente de Supabase

Archivo: `src/lib/supabase.js`

Variables usadas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Tambien existe:

- `VITE_WHATSAPP_NUMBER`, usado en `src/lib/utils.js` y `src/config/site.js`.

El cliente se crea solo si las variables existen y no contienen placeholders.

### Tablas utilizadas por el frontend activo

Detectadas en `src/lib/api.js`:

- `products`
- `product_images`
- `help_videos`
- `social_links`

### Campos conocidos de `products`

Segun `supabase/schema.sql`, `supabase.sql`, `src/lib/api.js`, `ProductForm`, `Catalogo`, `ProductDetail` y `ProductCard`:

- `id`
- `name`
- `slug`
- `brand`
- `model`
- `category`
- `internal_status`
- `public_stock_status`
- `cost_price`
- `wholesale_price`
- `suggested_price`
- `stock_quantity`
- `delivery_time`
- `delivery_included`
- `delivery_note`
- `warranty`
- `return_policy`
- `short_description`
- `long_description`
- `whatsapp_status_text`
- `marketplace_text`
- `reseller_group_text`
- `custom_whatsapp_message`
- `drive_link`
- `video_url`
- `main_image_url`
- `is_featured`
- `sort_priority`
- `created_at`
- `updated_at`

Observaciones:

- El campo `reseller_group_text` actualmente se reutiliza en `ProductForm` para guardar JSON de preguntas frecuentes.
- En `ProductDetail`, `normalizeFaqs` intenta leer FAQs desde `product.faqs`, `product.faq_items` o JSON en `reseller_group_text`.
- `ProductForm` elimina `short_description` del payload antes de guardar en la version activa, aunque el campo existe en SQL.
- `ProductForm` fuerza `category: null` al guardar en la version activa, aunque el catalogo contempla categorias.

### Campos conocidos de `product_images`

Segun SQL y codigo:

- `id`
- `product_id`
- `image_url`
- `sort_order`
- `created_at`

Relacion:

- `product_images.product_id` referencia `products.id` con `on delete cascade`.

### Campos conocidos de `help_videos`

Segun `supabase/admin_content.sql` y `src/lib/api.js`:

- `id`
- `title`
- `video_url`
- `duration`
- `thumbnail_url`
- `sort_order`
- `is_visible`
- `created_at`
- `updated_at`

### Campos conocidos de `social_links`

Segun `supabase/admin_content.sql` y `src/lib/api.js`:

- `network`
- `url`
- `created_at`
- `updated_at`

Valores administrados desde frontend:

- `instagram`
- `whatsapp`
- `tiktok`
- `facebook`

### Consultas SELECT detectadas

En `src/lib/api.js`:

- `getProducts({ includeHidden })`
  - Tabla: `products`
  - Si `includeHidden` es false: selecciona campos basicos `PRODUCT_LIST_FIELDS`.
  - Si `includeHidden` es true: selecciona `*`.
  - Ordena por `sort_priority desc`, luego `created_at desc`.
  - Si no incluye ocultos: filtra `internal_status = active`.

- `getProductBySlug(slug)`
  - Tabla: `products`
  - `select('*')`, filtro `slug`, `.single()`.
  - Luego consulta `product_images` por `product_id`, ordenado por `sort_order asc`.

- `getProductById(id)`
  - Tabla: `products`
  - `select('*')`, filtro `id`, `.single()`.
  - Luego consulta `product_images` por `product_id`, ordenado por `sort_order asc`.

- `getHelpVideos({ includeHidden })`
  - Tabla: `help_videos`
  - `select('*')`
  - Ordena por `sort_order asc`, luego `created_at desc`.
  - Filtra en frontend `is_visible !== false` si no incluye ocultos.

- `getSocialLinks()`
  - Tabla: `social_links`
  - Selecciona `network,url`.

### INSERT detectados

- `createProduct(payload, imageFiles)`
  - Inserta en `products`.
  - Inserta filas en `product_images` para galeria.

- `saveHelpVideo(payload)`
  - Inserta en `help_videos` si no existe `payload.id`.

- `saveSocialLinks(links)`
  - Usa `upsert` sobre `social_links`, no insert simple.

### UPDATE detectados

- `updateProduct(id, payload, imageFiles, imagesToDelete, imageReplacements)`
  - Actualiza `products`.
  - Actualiza `product_images.image_url` cuando hay reemplazos.

- `updateProductStatus(id, status)`
  - Actualiza `products.internal_status`.
  - Si `status === 'sold_out'`, guarda `internal_status: active` y `public_stock_status: agotado`.

- `saveHelpVideo(payload)`
  - Actualiza `help_videos` si existe `payload.id`.

- `saveSocialLinks(links)`
  - Upsert de `social_links`.

### DELETE detectados

- `deleteProduct(id)`
  - Borra en `products`.
  - Por SQL, `product_images` deberia borrarse en cascada por FK.

- `updateProduct(...)`
  - Borra imagenes de `product_images` con `.delete().in('id', imagesToDelete)`.

- `deleteHelpVideo(id)`
  - Borra en `help_videos`.

### Storage buckets utilizados

Bucket detectado:

- `product-images`

Uso en codigo:

- `uploadImage(file, folder = 'products')`
  - Sube a `product-images`.
  - Ruta interna: `${folder}/${Date.now()}-${random}.${ext}`.
  - Usa `cacheControl: '3600'`.
  - `upsert: false`.
  - Obtiene URL con `getPublicUrl`.

Uso en SQL:

- `supabase/schema.sql` crea o actualiza el bucket `product-images` como publico.
- `supabase.sql` legacy tambien crea bucket publico.
- Politicas de storage permiten lectura publica y escritura a `authenticated`.

### Funciones RPC

No se detectan llamadas `rpc(...)` en el frontend.

### Triggers

No se detectan triggers SQL en los archivos `supabase/*.sql` ni en `supabase.sql`.

### Politicas RLS/migraciones presentes

Archivos:

- `supabase/schema.sql`: esquema oficial para productos, imagenes y storage.
- `supabase/product_catalog_fields.sql`: agrega `is_featured` y `sort_priority`.
- `supabase/admin_content.sql`: agrega `help_videos`, `social_links`, RLS y `notify pgrst, 'reload schema'`.
- `supabase.sql`: esquema legacy.

RLS detectado:

- `products`: RLS habilitado.
  - Lectura publica de productos activos.
  - Lectura completa para authenticated.
  - Insert/update/delete para authenticated.
- `product_images`: RLS habilitado.
  - Lectura publica si pertenece a producto activo.
  - Lectura/escritura para authenticated.
- `help_videos`: RLS habilitado.
  - Lectura publica solo si `is_visible = true`.
  - Lectura/escritura para authenticated.
- `social_links`: RLS habilitado.
  - Lectura publica.
  - Administracion para authenticated.
- `storage.objects`: politicas sobre bucket `product-images`.
  - Lectura publica.
  - Insert/update/delete para authenticated.

## 4. Panel administrativo

### Rutas admin activas

- `/admin`: dashboard.
- `/admin/productos`: listado de productos.
- `/admin/productos/nuevo`: crear producto.
- `/admin/productos/:id/editar`: editar producto.
- `/admin/videos`: administrar videos de ayuda.
- `/admin/redes`: administrar redes sociales.

### Funciones actuales del admin

Dashboard (`src/pages/admin/AdminDashboard.jsx`):

- Carga todos los productos con `getProducts({ includeHidden: true })`.
- Muestra cantidad total.
- Muestra activos.
- Muestra agotados.
- Muestra ocultos.
- Suma precios mayoristas.
- Muestra ultimos 5 productos.
- Link para agregar producto.

Listado de productos (`src/pages/admin/ProductList.jsx`):

- Carga productos incluyendo ocultos.
- Muestra tabla con imagen, categoria, precio mayorista, precio sugerido, posible ganancia, destacado, orden, estado y acciones.
- Permite ver producto publico.
- Permite editar producto.
- Permite activar/ocultar.
- Permite marcar agotado.
- Permite eliminar producto con confirmacion.

Formulario de producto (`src/pages/admin/ProductForm.jsx`):

- Crea y edita productos.
- Campos basicos: titulo, slug, marca, modelo, estado, stock, destacado, prioridad.
- Precios: costo, mayorista, sugerido, ganancia calculada.
- Descripcion: `long_description`.
- Entrega/garantia.
- Material: imagen principal por archivo o URL, imagenes secundarias, link Google Drive.
- Gestion de imagen principal actual.
- Gestion de imagenes secundarias existentes: eliminar o reemplazar.
- Preguntas frecuentes: se guardan como JSON en `reseller_group_text`.
- Al guardar, llama `createProduct` o `updateProduct`.

Videos de ayuda (`src/pages/admin/HelpVideosAdmin.jsx`):

- Carga videos con `getHelpVideos({ includeHidden: true })`.
- Crea/edita videos con `saveHelpVideo`.
- Elimina videos con `deleteHelpVideo`.
- Campos: titulo, URL del video, duracion, miniatura, orden, visible.
- Si no hay videos muestra "Todavia no hay videos cargados."

Redes sociales (`src/pages/admin/SocialLinksAdmin.jsx`):

- Carga redes con `getSocialLinks`.
- Guarda redes con `saveSocialLinks`.
- Campos: WhatsApp, Instagram, TikTok, Facebook.

### Archivos que manejan productos, videos, redes, reglas y contenido

Productos:

- `src/pages/admin/ProductForm.jsx`
- `src/pages/admin/ProductList.jsx`
- `src/pages/admin/AdminDashboard.jsx`
- `src/pages/Catalogo.jsx`
- `src/pages/ProductDetail.jsx`
- `src/components/ProductCard.jsx`
- `src/lib/api.js`
- `src/lib/utils.js`

Videos:

- `src/pages/admin/HelpVideosAdmin.jsx`
- `src/pages/Ayuda.jsx`
- `src/lib/api.js`
- `supabase/admin_content.sql`

Redes:

- `src/pages/admin/SocialLinksAdmin.jsx`
- `src/pages/Redes.jsx`
- `src/pages/Home.jsx` usa WhatsApp por env.
- `src/lib/api.js`
- `supabase/admin_content.sql`

Reglas:

- `src/pages/Reglas.jsx`
- Reglas hardcodeadas en el componente.
- No hay tabla de reglas detectada.

Materiales:

- `src/pages/Materiales.jsx`
- `ProductDetail` usa `drive_link` para descargar imagenes/videos.
- No hay tabla separada de materiales.

### Componentes reutilizables

- `Layout` / `AdminLayout`.
- `ProtectedRoute`.
- `ProductCard`.
- `StatCard`.
- `Toast` y `ui.jsx` existen, pero se usan principalmente en codigo legacy/no activo.

## 5. Sitio publico

### Rutas y paginas publicas

- `/`: portada tipo acceso rapido.
- `/reventa`: explicacion de como funciona la reventa.
- `/catalogo`: listado de productos.
- `/producto/:slug`: detalle de producto.
- `/materiales`: indica que los materiales se descargan desde el detalle del producto.
- `/ayuda`: videos de ayuda.
- `/reglas`: reglas para revendedores.
- `/redes`: links sociales y WhatsApp.
- `/login`: login admin, publico como ruta pero funcionalmente entrada al area privada.

### Como funciona el catalogo

Archivo: `src/pages/Catalogo.jsx`

1. Al montar, llama `getProducts()`.
2. `getProducts()` consulta `products` con campos basicos:
   - `id`
   - `name`
   - `slug`
   - `category`
   - `internal_status`
   - `public_stock_status`
   - `wholesale_price`
   - `suggested_price`
   - `main_image_url`
   - `is_featured`
   - `sort_priority`
   - `created_at`
3. Si no hay Supabase configurado, usa `demoProduct`.
4. Filtra en frontend por busqueda, categoria y estado.
5. Ordena por prioridad, recientes, ganancia, precio menor o precio mayor.
6. Renderiza cada item con `ProductCard`.

### Como se cargan imagenes

- Catalogo: `ProductCard` usa `getDisplayImageUrl(product.main_image_url, { width: 420, height: 420, resize: 'contain' })`.
- Detalle: `ProductDetail` usa `getDisplayImageUrl(product.main_image_url, { width: 900, height: 700, resize: 'contain' })`.
- Galeria: `ProductDetail` carga `product_images` y usa `getDisplayImageUrl` con 220x220.
- `getDisplayImageUrl` convierte URLs publicas de Supabase Storage desde `/storage/v1/object/public/` a `/storage/v1/render/image/public/` con parametros `width`, `height`, `resize` y `quality=72`.
- Si la URL es Google Drive, se considera no apta como imagen directa y se usa `/placeholder.svg`.
- Si la imagen falla, `imageFallback` cambia el `src` a `/placeholder.svg` y desactiva `onerror`.

### Como se cargan videos

- Videos de ayuda: `Ayuda` llama `getHelpVideos()` sobre la tabla `help_videos`.
- Cada video abre `video.video_url` en una pestaña nueva.
- Miniatura: `thumbnail_url`, optimizada por `getDisplayImageUrl` si es Supabase/publica directa.
- Video de producto: existe campo `video_url` en productos, pero en la vista activa `ProductDetail.jsx` no se renderiza actualmente como boton separado.

### Como se cargan precios, stock y descripciones

- Catalogo carga solo campos basicos de precio/stock desde `products`.
- Detalle carga `products.*` por slug.
- Precios:
  - `wholesale_price`
  - `suggested_price`
  - ganancia calculada como `suggested_price - wholesale_price`.
- Stock:
  - `public_stock_status`
  - `internal_status`
  - `isSoldOut` considera `public_stock_status === 'agotado'` o `internal_status === 'sold_out'`.
- Descripcion:
  - `ProductDetail` muestra `long_description`.
  - `ProductForm` activo guarda la descripcion principal en `long_description`.

### Navegacion desde portada

Archivo: `src/pages/Home.jsx`

Links actuales:

- `Ver catalogo` -> `/catalogo`
- `Videos de ayuda` -> `/ayuda`
- `Contactar por WhatsApp` -> link externo `wa.me`
- `Redes sociales` -> `/redes`
- `Reglas para revendedores` -> `/reglas`

Observacion:

- Actualmente no aparece un boton visible a `/materiales` en `Home.jsx`, aunque la ruta existe.
- El subtitulo y seccion "Como funciona" no estan presentes en el estado actual de `Home.jsx`.

## 6. Modelo de datos actual

### Entidades existentes

```text
products
  id (uuid)
  slug (unique)
  datos comerciales
  precios
  stock/status
  textos/materiales
  main_image_url
  merchandising: is_featured, sort_priority
  timestamps

product_images
  id (uuid)
  product_id -> products.id
  image_url
  sort_order
  created_at

help_videos
  id (uuid)
  title
  video_url
  duration
  thumbnail_url
  sort_order
  is_visible
  timestamps

social_links
  network (pk)
  url
  timestamps

storage.objects
  bucket product-images
  imagenes subidas desde admin
```

### Relaciones existentes

- `products 1:N product_images`
- `help_videos` no se relaciona con productos ni usuarios.
- `social_links` no se relaciona con usuarios.
- Supabase Auth existe, pero no hay tabla propia que relacione `auth.users` con perfiles/roles.

### Reutilizacion posible para futuras entidades

Revendedores:

- No hay tabla actual.
- Se podria reutilizar Supabase Auth para credenciales.
- Recomendado crear `profiles` o `users_app` relacionada con `auth.users.id`.
- No reutilizar `products` para datos de revendedores.

Ventas:

- No hay tabla actual.
- Reutilizable: `products.id`, `wholesale_price`, `suggested_price`, `stock_quantity` como referencia.
- Recomendado crear `sales` con snapshot de precio para no depender de cambios futuros del producto.

Comisiones:

- No hay tabla actual.
- Reutilizable: ganancia calculada actual como base, pero debe guardarse snapshot por venta.
- Recomendado crear `commissions` o campos en `sales` (`commission_amount`, `commission_status`, `paid_at`).

Pagos:

- No hay tabla actual.
- Recomendado crear `commission_payments` para pagos agrupados a revendedores.

Clientes:

- No hay tabla actual.
- Recomendado crear `customers` o guardar datos minimos dentro de `sales`, segun privacidad y operativa.

Inventario:

- Campo actual: `products.stock_quantity`.
- Estados actuales: `internal_status`, `public_stock_status`.
- Para inventario serio, recomendado crear `inventory_movements` o `stock_movements`.

Gastos:

- No hay tabla actual.
- Recomendado crear `expenses` categorizados y asociados opcionalmente a venta/proveedor.

Flujo de caja:

- No hay tabla actual.
- Recomendado crear `cash_movements` o derivar desde `sales`, `commission_payments` y `expenses`.

## 7. Riesgos antes de implementar

### Riesgos de romper funciones existentes

- `src/lib/api.js` centraliza casi todas las operaciones. Cambios ahi afectan catalogo, detalle, admin, videos y redes.
- `products.reseller_group_text` esta siendo reutilizado para FAQs como JSON. Cambiar su significado puede romper preguntas frecuentes o texto legacy.
- `ProductForm` activo elimina `short_description` y fuerza `category: null`; si se reintroducen categorias o descripciones cortas hay que revisar ese comportamiento.
- Las rutas activas usan `src/pages/admin/*`, pero existe `src/admin/*` legacy con imports rotos. Refactors globales podrian tocar archivos equivocados.
- `src/pages/Producto.jsx` legacy no esta activo pero tiene imports inexistentes. Si se conecta accidentalmente, romperia build/runtime.
- `src/index.css` y Tailwind estan presentes pero la app activa usa `src/styles/main.css`; mezclar sistemas sin plan puede duplicar estilos.
- Carpeta anidada `camaraza-store/` puede confundir commits o ediciones si no se trabaja siempre desde la raiz correcta.

### Riesgos de seguridad

- No hay roles. Cualquier usuario autenticado podria ser admin segun RLS actual.
- Las politicas admin son demasiado amplias para un futuro con revendedores autenticados.
- Storage `product-images` permite escrituras a cualquier `authenticated`.
- No hay auditoria de acciones administrativas.
- No hay confirmacion en codigo de politicas aplicadas en la base real; solo existen SQL en el repo.
- No confirmado si la base en produccion tiene exactamente estas migraciones aplicadas.

### Riesgos de mezclar datos administrativos con datos de revendedores

- Si se agregan revendedores con Supabase Auth sin cambiar RLS, podrian tener permisos administrativos.
- Si ventas/comisiones se guardan en tablas con politicas amplias para `authenticated`, un revendedor podria ver datos de otros.
- Finanzas internas no deben compartir permisos con panel de revendedor.
- Productos publicos y precios mayoristas actualmente son visibles para todos los visitantes del catalogo. Si se desea proteger precios por revendedor autenticado, requiere rediseño de RLS/rutas.

### Dependencias o archivos sensibles

- `.env` no debe tocarse.
- `.env.example` solo contiene placeholders.
- `src/lib/supabase.js` depende de variables `VITE_*`.
- `vercel.json` contiene rewrite SPA.
- `package-lock.json` fija versiones instaladas.
- `supabase/*.sql` son cambios de base que requieren cuidado.

### Cambios de base de datos que requeririan respaldo

- Cambiar RLS de `products`, `product_images`, `help_videos`, `social_links` y `storage.objects`.
- Crear tablas de usuarios/roles.
- Migrar FAQs desde `reseller_group_text` a una tabla/campo dedicado.
- Agregar ventas/comisiones/pagos/finanzas.
- Cambiar tipos o constraints de estados/precios.
- Limpiar datos legacy como `category: null` o textos JSON.

## 8. Recomendacion de arquitectura

Objetivo: integrar sistema de revendedores dentro del mismo proyecto sin romper el admin actual.

### Rutas recomendadas

- `/login`
  - Login unico.
  - Despues de iniciar sesion, redirigir segun rol:
    - `admin` -> `/admin`
    - `reseller` -> `/panel`

- `/admin`
  - Panel administrativo de Camaraza.
  - Gestion de productos, videos, redes, reglas, usuarios revendedores, ventas, comisiones, pagos, finanzas.

- `/panel`
  - Panel individual del revendedor.
  - Solo ve sus ventas, sus comisiones, sus datos y herramientas simples para vender.

### Roles

Crear una tabla de perfiles/roles:

```text
profiles
  id uuid primary key references auth.users(id)
  role text check role in ('admin', 'reseller')
  full_name text
  phone text
  is_active boolean default true
  created_by uuid references auth.users(id)
  created_at timestamptz
  updated_at timestamptz
```

Principio de seguridad:

- El rol debe validarse en RLS, no solo en React.
- React puede ocultar/mostrar vistas para UX, pero Supabase debe impedir accesos indebidos.
- Los usuarios revendedores deben ser creados por admin.
- No permitir registro publico libre si el negocio quiere control.

### Usuarios creados solo por administrador

Opciones:

1. Admin crea usuarios desde Supabase Dashboard manualmente y luego completa `profiles`.
2. Crear una Edge Function con service role para que el admin cree usuarios desde el panel.

Recomendacion:

- Fase inicial segura: crear usuarios manualmente en Supabase y administrar `profiles` desde SQL/admin interno simple.
- Fase posterior: Edge Function para invitaciones/creacion controlada.

### Panel individual del revendedor

Rutas sugeridas:

- `/panel`: resumen simple.
- `/panel/catalogo`: catalogo para revendedor autenticado, si se decide protegerlo.
- `/panel/ventas`: mis ventas.
- `/panel/ventas/nueva`: registrar venta.
- `/panel/comisiones`: comisiones pendientes/pagadas.
- `/panel/perfil`: datos del revendedor.

UX recomendada:

- Mobile-first.
- Botones grandes.
- Flujo corto: elegir producto -> cargar cliente -> confirmar venta pendiente.
- Estados claros: pendiente, confirmada, entregada, anulada, comision pagada.

### Sistema de ventas y comisiones

Tablas sugeridas:

```text
sales
  id uuid primary key
  reseller_id uuid references profiles(id)
  product_id uuid references products(id)
  customer_name text
  customer_phone text
  customer_address text
  quantity integer
  sale_price numeric
  wholesale_price_snapshot numeric
  commission_amount numeric
  status text -- pending, confirmed, delivered, cancelled, returned
  admin_notes text
  reseller_notes text
  created_at timestamptz
  updated_at timestamptz

commission_payments
  id uuid primary key
  reseller_id uuid references profiles(id)
  amount numeric
  period_start date
  period_end date
  status text -- pending, paid, cancelled
  paid_at timestamptz
  payment_method text
  notes text
  created_at timestamptz

sale_events
  id uuid primary key
  sale_id uuid references sales(id)
  actor_id uuid references profiles(id)
  event_type text
  from_status text
  to_status text
  notes text
  created_at timestamptz
```

Regla clave:

- Guardar snapshots de precios/comision en la venta. No recalcular comisiones historicas con precios actuales del producto.

### Finanzas de Camaraza Store

Tablas sugeridas:

```text
expenses
  id uuid primary key
  category text
  amount numeric
  description text
  expense_date date
  created_by uuid references profiles(id)
  created_at timestamptz

cash_movements
  id uuid primary key
  type text -- income, expense, commission_payment, adjustment
  amount numeric
  source_table text
  source_id uuid
  notes text
  movement_date date
  created_by uuid references profiles(id)
  created_at timestamptz
```

Separacion recomendada:

- `admin` ve todo.
- `reseller` ve solo sus ventas/comisiones.
- Publico ve solo contenido comercial visible.
- Finanzas internas nunca visibles para revendedores.

## 9. Plan de implementacion por fases

### Fase 0 - Respaldo y saneamiento previo

Objetivo:

- Preparar el proyecto antes de tocar auth/RLS.

Archivos probables a modificar:

- Ninguno inicialmente.
- Posible documentacion adicional.

Cambios Supabase:

- Ninguno.
- Exportar respaldo de tablas actuales.
- Confirmar politicas realmente aplicadas en produccion.

Pruebas necesarias:

- Login admin.
- Crear/editar producto.
- Catalogo publico.
- Detalle de producto.
- Videos y redes.

Riesgos:

- No confirmar produccion podria hacer que el plan parta de una base distinta al repo.

### Fase 1 - Roles y perfiles sin cambiar UX publica

Objetivo:

- Introducir `profiles` y rol `admin`/`reseller`.
- Mantener admin actual funcionando.
- Preparar RLS para futuro panel reseller.

Archivos probables a modificar:

- `src/lib/api.js`
- `src/components/ProtectedRoute.jsx`
- `src/pages/Login.jsx`
- Posible nuevo helper `src/lib/roles.js`
- Nueva migracion SQL en `supabase/`

Cambios Supabase:

- Crear `profiles`.
- Crear funcion SQL helper para validar rol, por ejemplo `is_admin()`.
- Migrar usuario admin actual a `profiles.role = 'admin'`.
- Ajustar RLS admin para usar rol admin, no solo `authenticated`.

Pruebas necesarias:

- Usuario admin puede entrar a `/admin`.
- Usuario sin perfil o revendedor no puede entrar a `/admin`.
- Catalogo publico sigue funcionando.
- CRUD productos sigue funcionando con admin.

Riesgos:

- Si RLS se aplica mal, puede bloquear el admin.
- Requiere respaldo y prueba con usuario admin real.

### Fase 2 - Login unico y redireccion por rol

Objetivo:

- Que `/login` redirija a `/admin` o `/panel` segun rol.
- Sin implementar aun ventas completas.

Archivos probables a modificar:

- `src/pages/Login.jsx`
- `src/components/ProtectedRoute.jsx`
- Nuevo `src/components/RoleRoute.jsx`
- `src/App.jsx`
- Nueva pagina placeholder `src/pages/panel/PanelHome.jsx`

Cambios Supabase:

- Ninguno si Fase 1 ya creo `profiles`.

Pruebas necesarias:

- Admin entra a `/admin`.
- Revendedor entra a `/panel`.
- Revendedor no entra a `/admin`.
- Usuario no autenticado vuelve a `/login`.

Riesgos:

- Lo mas delicado es no romper login admin actual.

### Fase 3 - Panel basico del revendedor

Objetivo:

- Crear panel simple para el revendedor.
- Mostrar datos propios, comisiones/resumen en cero o desde tablas nuevas.

Archivos probables a modificar:

- `src/App.jsx`
- Nuevos archivos en `src/pages/panel/`
- Nuevos componentes de layout para panel reseller.
- `src/lib/api.js` o nuevo `src/lib/resellerApi.js`

Cambios Supabase:

- Crear tablas `sales` y posiblemente `sale_events`.
- RLS para que reseller lea solo sus ventas.
- Admin lee todo.

Pruebas necesarias:

- Revendedor solo ve lo suyo.
- Admin ve todo.
- Publico no ve datos privados.

Riesgos:

- Riesgo alto de filtracion si RLS no limita por `auth.uid()`.

### Fase 4 - Registro de ventas

Objetivo:

- Permitir que revendedor registre una venta pendiente.
- Admin confirma, entrega o cancela.

Archivos probables a modificar:

- `src/pages/panel/Sales.jsx`
- `src/pages/panel/NewSale.jsx`
- `src/pages/admin/SalesAdmin.jsx`
- `src/lib/resellerApi.js`
- `src/lib/adminApi.js`
- `src/App.jsx`
- `src/components/Layout.jsx`

Cambios Supabase:

- Completar `sales`.
- Agregar indices por `reseller_id`, `status`, `created_at`.
- Opcional: trigger para calcular comision inicial o registrar eventos.

Pruebas necesarias:

- Crear venta como revendedor.
- Ver venta propia.
- Otro revendedor no puede verla.
- Admin puede cambiar estado.
- Comision queda congelada por snapshot.

Riesgos:

- Estados mal definidos pueden afectar pagos.
- Datos de clientes requieren cuidado de privacidad.

### Fase 5 - Comisiones y pagos

Objetivo:

- Gestionar comisiones pendientes/pagadas.
- Registrar pagos a revendedores.

Archivos probables a modificar:

- Nuevas paginas admin de comisiones/pagos.
- Nuevas paginas panel de comisiones.
- APIs dedicadas.

Cambios Supabase:

- Crear `commission_payments`.
- Ajustar `sales` para estados de comision si hace falta.
- RLS estricta por rol.

Pruebas necesarias:

- Admin registra pago.
- Revendedor ve solo sus pagos.
- Totales coinciden con ventas entregadas.

Riesgos:

- Errores financieros si se recalculan montos historicos.
- Necesita auditoria basica.

### Fase 6 - Finanzas internas

Objetivo:

- Flujo de caja, gastos, ingresos y reportes internos de Camaraza.

Archivos probables a modificar:

- Nuevas paginas en `/admin/finanzas`.
- Nuevas APIs.

Cambios Supabase:

- Crear `expenses`.
- Crear `cash_movements`.
- Posibles vistas SQL para reportes.

Pruebas necesarias:

- Solo admin accede.
- Totales por periodo.
- Relacion con ventas y pagos.

Riesgos:

- Informacion sensible.
- Requiere politicas RLS muy cerradas.

### Fase 7 - Saneamiento tecnico

Objetivo:

- Eliminar o aislar codigo legacy cuando ya no se use.
- Mejorar mantenibilidad sin cambiar comportamiento.

Archivos probables a modificar:

- `src/admin/*`
- `src/pages/Producto.jsx`
- `src/components/PublicLayout.jsx`
- `src/lib/auth.jsx`
- `src/index.css`
- `tailwind.config.js`

Cambios Supabase:

- Ninguno.

Pruebas necesarias:

- Build.
- Rutas publicas.
- Rutas admin.
- Login/logout.

Riesgos:

- Borrar codigo que alguien esperaba reutilizar. Antes conviene confirmar con git history o equipo.

## 10. Observaciones finales

### Estado actual resumido

- La app publica esta orientada a reventa mobile-first.
- El catalogo carga datos livianos en listado y datos completos en detalle.
- Las imagenes usan lazy loading y placeholder.
- Supabase esta integrado para productos, imagenes, videos y redes.
- El admin tiene CRUD de productos, videos y redes.
- El login admin usa Supabase Auth.
- No hay sistema de revendedores autenticados, ventas, comisiones, pagos, clientes, inventario avanzado, gastos ni flujo de caja.

### No confirmado

- No confirmado que las migraciones del repo esten aplicadas exactamente en la base Supabase de produccion.
- No confirmado que el bucket `product-images` exista y sea publico en produccion, aunque el SQL lo crea.
- No confirmado que todos los usuarios autenticados actuales deban ser administradores.
- No confirmado si hay usuarios revendedores ya creados manualmente en Supabase Auth.
- No confirmado si `.env` local tiene variables reales, porque no se inspecciono ni debe tocarse.
- No confirmado el estado de RLS real en Supabase fuera de lo visible en archivos SQL.

### Recomendacion principal

Antes de implementar el sistema de revendedores, la primera fase tecnica debe ser roles + perfiles + RLS por rol. Sin esa base, agregar `/panel` para revendedores sobre Supabase Auth podria abrir permisos administrativos a usuarios que solo deberian ver su informacion.
