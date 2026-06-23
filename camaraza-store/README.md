# Camaraza Store · Catálogo para revendedores (V1)

Web catálogo + panel admin privado. React + Vite + Tailwind + Supabase, lista para Vercel.

- **Público:** `/` · `/reventa` · `/catalogo` · `/producto/:slug`
- **Admin (privado):** `/login` · `/admin` · `/admin/productos` · `/admin/productos/nuevo` · `/admin/productos/:id/editar`

---

## 1. Configurar Supabase

1. Entrá a [supabase.com](https://supabase.com) → **New project**. Anotá la contraseña de la base.
2. En el menú lateral: **SQL Editor → New query**.
3. Copiá TODO el contenido de `supabase.sql` y tocá **Run**. Eso crea:
   - tablas `products`, `product_images`, `settings`
   - las políticas de seguridad (RLS)
   - el bucket de Storage `product-images`
   - un producto de prueba
4. **Crear tu usuario admin:** menú **Authentication → Users → Add user → Create new user**.
   Poné tu email y una contraseña. Con ese email y contraseña vas a entrar a `/login`.
   > Cualquier usuario que crees acá puede entrar al admin. No compartas estas credenciales.
5. Conseguí tus claves: **Project Settings → API**. Copiá:
   - **Project URL** → va en `VITE_SUPABASE_URL`
   - **anon public key** → va en `VITE_SUPABASE_ANON_KEY`

---

## 2. Variables de entorno

Copiá `.env.example` como `.env` y completá:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_WHATSAPP_NUMBER=595981123456
```

> El número de WhatsApp va en formato internacional sin `+` ni espacios.
> Paraguay = `595` + número sin el 0 inicial. Ej: `0981 123 456` → `595981123456`.

---

## 3. Correr en tu compu (Windows / PowerShell)

```powershell
npm install
npm run dev
```

Abrí lo que diga la terminal (normalmente `http://localhost:5173`).

---

## 4. Subir a Vercel

1. Subí el proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com): **Add New → Project** → importá el repo.
3. Framework: **Vite** (lo detecta solo).
4. En **Environment Variables** cargá las 3 variables del paso 2
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WHATSAPP_NUMBER`).
5. **Deploy.** El `vercel.json` ya está incluido para que las rutas internas funcionen.
6. Dominio: cuando tengas `camarazastore.com`, agregalo en **Settings → Domains**.

---

## 5. Crear tu primer producto

1. Entrá a `tu-sitio.com/login` con el email/contraseña que creaste en Supabase.
2. **Agregar producto.**
3. Escribí el nombre (el *slug* de la URL se genera solo).
4. Cargá precio mayorista y sugerido → la **ganancia se calcula automática**.
5. Subí la **foto principal** (se guarda en Supabase Storage).
6. Tocá **Crear producto**. Ahí recién podés agregar **fotos secundarias**.
7. Pegá el **link de Google Drive** con el material y, si tenés, el link de video.
8. Estado interno **Activo** = aparece en el catálogo público.

---

## 6. Cómo funcionan los estados

| Estado interno | Qué hace |
|---|---|
| `active` | Visible en el catálogo público |
| `hidden` | Oculto, solo lo ves vos en el admin |
| `sold_out` | Oculto del catálogo (marcado agotado) |

El **estado público** (Disponible / Consultar stock / Últimas unidades / Agotado) es solo
la etiqueta que ve el revendedor. La recomendación por defecto es **Consultar stock**.

---

## 7. Qué incluye cada producto para el revendedor

En `/producto/:slug` el revendedor tiene:
- Botón **Consultar stock por WhatsApp** (mensaje precargado con nombre y precios).
- Botón **Descargar material** (abre tu carpeta de Drive).
- Botones para **copiar** descripción, texto de estado, texto de Marketplace y texto de grupo.

---

## 8. Preparado para crecer (V2/V3)

La base ya queda lista para sumar después: login de revendedores, código por revendedor,
registro de ventas, comisiones, ranking, estadísticas y control real de stock.
Nada de eso está activo en V1, como pediste.

---

## Stack

React 18 · Vite 5 · React Router 6 · Tailwind 3 · Supabase (DB + Auth + Storage) · Vercel.
