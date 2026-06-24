-- ============================================================
--  CAMARAZA STORE · Esquema legacy para Supabase (V1)
--  Referencia histórica. Para nuevas instalaciones usá:
--  supabase/schema.sql
-- ============================================================

-- ---------- TABLA: products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  brand text,
  model text,
  category text,
  internal_status text default 'active',          -- active | hidden | sold_out
  public_stock_status text default 'consultar_stock', -- disponible | consultar_stock | ultimas_unidades | agotado
  cost_price numeric default 0,
  wholesale_price numeric not null default 0,
  suggested_price numeric not null default 0,
  stock_quantity integer,
  delivery_time text,
  delivery_included boolean default false,
  delivery_note text,
  warranty text,
  return_policy text,
  short_description text,
  long_description text,
  whatsapp_status_text text,
  marketplace_text text,
  reseller_group_text text,
  custom_whatsapp_message text,
  drive_link text,
  video_url text,
  main_image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists products_internal_status_idx on public.products(internal_status);
create index if not exists products_category_idx on public.products(category);

-- ---------- TABLA: product_images ----------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  image_url text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists product_images_product_idx on public.product_images(product_id);

-- ---------- TABLA opcional: settings (V1 no la usa, queda lista) ----------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  whatsapp_number text,
  store_name text,
  main_domain text
);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- products: lectura pública SOLO de activos; admin (logueado) ve y edita todo
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
  on public.products for select
  using (internal_status = 'active');

drop policy if exists "products_admin_read_all" on public.products;
create policy "products_admin_read_all"
  on public.products for select
  to authenticated
  using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

-- product_images: lectura pública, escritura solo admin
drop policy if exists "images_public_read" on public.product_images;
create policy "images_public_read"
  on public.product_images for select
  using (true);

drop policy if exists "images_admin_write" on public.product_images;
create policy "images_admin_write"
  on public.product_images for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
--  STORAGE: bucket "product-images"
--  (También podés crearlo desde la UI: Storage > New bucket > Public)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Lectura pública de imágenes
drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Subir / actualizar / borrar solo admin logueado
drop policy if exists "storage_admin_write" on storage.objects;
create policy "storage_admin_write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

-- ============================================================
--  DATOS DE PRUEBA
-- ============================================================
insert into public.products (
  name, slug, brand, model, category,
  internal_status, public_stock_status,
  cost_price, wholesale_price, suggested_price,
  delivery_time, delivery_included, delivery_note,
  warranty, return_policy,
  short_description, long_description,
  whatsapp_status_text, marketplace_text, reseller_group_text
) values (
  'Máquina profesional para cortar pelo Ecopower EP-2811',
  'maquina-profesional-cortar-pelo-ecopower-ep-2811',
  'Ecopower', 'EP-2811', 'Barbería',
  'active', 'consultar_stock',
  65000, 85000, 145000,
  'Dentro de las 24 horas según disponibilidad', false, 'El delivery se cotiza aparte según zona.',
  '48 horas por falla de fábrica', 'Cambio solo por falla de fábrica dentro de garantía.',
  'Máquina profesional para cortar pelo, ideal para uso personal o barbería.',
  'Producto nuevo en caja. Cuenta con carga USB, batería de litio, motor potente de 11.000 RPM y cuchilla ajustable Zero Gap. Ideal para cortes, retoques, barba y uso diario.',
  'Disponible máquina profesional para cortar pelo. Ideal para barbería o uso personal. Precio: 145.000 Gs. Consultar disponibilidad.',
  'Máquina profesional para cortar pelo Ecopower EP-2811. Producto nuevo en caja, carga USB, batería de litio, motor potente y cuchilla ajustable. Ideal para barbería o uso personal. Entrega disponible. Consultar stock.',
  'Producto disponible para reventa. Precio mayorista: 85.000 Gs. Precio sugerido: 145.000 Gs. Posible ganancia: 60.000 Gs. Delivery no incluido. Consultar stock antes de vender.'
)
on conflict (slug) do nothing;
