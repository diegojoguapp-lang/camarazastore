# Camaraza Store | Catálogo de Re-venta

Proyecto V1 para crear un catálogo online para revendedores de **Camaraza Store**, con panel admin para cargar productos, precios, fotos, videos, links de Drive y textos listos para copiar.

## Qué incluye

- Web pública:
  - `/` inicio
  - `/reventa` explicación del sistema
  - `/catalogo` catálogo de productos
  - `/producto/:slug` detalle del producto
- Admin privado:
  - `/login`
  - `/admin`
  - `/admin/productos`
  - `/admin/productos/nuevo`
  - `/admin/productos/:id/editar`
- Supabase Auth para entrar al admin.
- Supabase Database para productos.
- Supabase Storage para imágenes.
- Botón de WhatsApp con mensaje automático.
- Botones para copiar textos de venta.
- Link de Google Drive para descargar material.
- Diseño responsive pensado para celular.

## Stack

- React + Vite
- Supabase
- Vercel
- CSS puro

## Instalación local

```bash
npm install
cp .env.example .env
npm run dev
```

Luego abrí:

```bash
http://localhost:5173
```

## Variables de entorno

En `.env` cargá:

```bash
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
VITE_WHATSAPP_NUMBER=595XXXXXXXXX
```

`VITE_WHATSAPP_NUMBER` debe ir sin `+`, sin espacios y con código país.

Ejemplo Paraguay:

```bash
VITE_WHATSAPP_NUMBER=595981123456
```

## Configurar Supabase

1. Crear un proyecto en Supabase.
2. Ir a **SQL Editor**.
3. Copiar y ejecutar el esquema oficial:

```bash
supabase/schema.sql
```

> Nota: el archivo `supabase.sql` que existe en la raíz queda como referencia legacy. Para nuevas instalaciones usá `supabase/schema.sql`.

4. Ir a **Authentication > Users**.
5. Crear tu usuario admin con email y contraseña.
6. Ir a **Storage** y confirmar que existe el bucket `product-images`.

## Configurar Vercel

1. Subir el proyecto a GitHub.
2. Importarlo en Vercel.
3. Agregar estas variables en **Project Settings > Environment Variables**:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WHATSAPP_NUMBER
```

4. Deploy.

El archivo `vercel.json` ya incluye rewrite para que las rutas React funcionen.

## Crear el primer producto

1. Entrar a `/login`.
2. Iniciar sesión con el usuario creado en Supabase.
3. Ir a `/admin/productos/nuevo`.
4. Cargar:
   - nombre
   - marca/modelo
   - categoría
   - precio mayorista
   - precio sugerido
   - descripción
   - textos para publicar
   - foto principal
   - fotos secundarias
   - link de Drive
5. Guardar.
6. Ir a `/catalogo` y verificar que aparece.

## Recomendación operativa

Para evitar problemas de stock, usar por defecto el estado público:

```bash
Consultar stock
```

Así el revendedor siempre te escribe antes de prometer entrega.

## Qué NO incluye esta V1

- Carrito de compras
- Pagos online
- Login de revendedores
- Comisiones automáticas
- Pedidos
- Facturación
- WhatsApp API
- Ranking de revendedores

Eso queda preparado para futuras versiones.
