-- Camaraza Store Re-venta - Supabase SQL
-- Ejecutar en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  brand text,
  model text,
  category text,
  internal_status text default 'active' check (internal_status in ('active', 'hidden', 'sold_out')),
  public_stock_status text default 'consultar_stock' check (public_stock_status in ('disponible', 'consultar_stock', 'ultimas_unidades', 'agotado')),
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
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_internal_status_idx on public.products(internal_status);
create index if not exists products_category_idx on public.products(category);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  image_url text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create index if not exists product_images_product_id_idx on public.product_images(product_id);

-- Bucket público para imágenes.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- Lectura pública: los revendedores pueden ver productos activos.
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products
for select
using (internal_status = 'active');

-- Admin autenticado: puede leer todo.
drop policy if exists "Authenticated can read all products" on public.products;
create policy "Authenticated can read all products"
on public.products
for select
using (auth.role() = 'authenticated');

-- Admin autenticado: puede crear/editar/eliminar productos.
drop policy if exists "Authenticated can insert products" on public.products;
create policy "Authenticated can insert products"
on public.products
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update products" on public.products;
create policy "Authenticated can update products"
on public.products
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete products" on public.products;
create policy "Authenticated can delete products"
on public.products
for delete
to authenticated
using (true);

-- Product images: lectura pública cuando pertenece a producto activo.
drop policy if exists "Public can read product images" on public.product_images;
create policy "Public can read product images"
on public.product_images
for select
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id
    and p.internal_status = 'active'
  )
);

-- Admin autenticado: puede leer/escribir imágenes.
drop policy if exists "Authenticated can read all product images" on public.product_images;
create policy "Authenticated can read all product images"
on public.product_images
for select
to authenticated
using (true);

drop policy if exists "Authenticated can insert product images" on public.product_images;
create policy "Authenticated can insert product images"
on public.product_images
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update product images" on public.product_images;
create policy "Authenticated can update product images"
on public.product_images
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete product images" on public.product_images;
create policy "Authenticated can delete product images"
on public.product_images
for delete
to authenticated
using (true);

-- Storage policies para bucket product-images.
drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "Authenticated can upload product images" on storage.objects;
create policy "Authenticated can upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images');

drop policy if exists "Authenticated can update product images storage" on storage.objects;
create policy "Authenticated can update product images storage"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

drop policy if exists "Authenticated can delete product images storage" on storage.objects;
create policy "Authenticated can delete product images storage"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images');

-- Producto demo opcional. Puedes eliminarlo luego.
insert into public.products (
  name, slug, brand, model, category, internal_status, public_stock_status,
  cost_price, wholesale_price, suggested_price, delivery_time, delivery_included,
  delivery_note, warranty, return_policy, short_description, long_description,
  whatsapp_status_text, marketplace_text, reseller_group_text, drive_link
) values (
  'Máquina profesional para cortar pelo Ecopower EP-2811',
  'maquina-profesional-ecopower-ep2811',
  'Ecopower',
  'EP-2811',
  'Barbería',
  'active',
  'consultar_stock',
  50000,
  85000,
  145000,
  'Dentro de las 24 horas según disponibilidad',
  false,
  'El delivery no está incluido en el precio mayorista.',
  '48 horas por falla de fábrica',
  'La comisión se confirma cuando la venta fue entregada correctamente y no hay reclamo pendiente.',
  'Máquina profesional para cortar pelo, ideal para uso personal o barbería.',
  'Producto nuevo en caja. Cuenta con carga USB, batería de litio, motor potente de 11.000 RPM y cuchilla ajustable Zero Gap. Ideal para cortes, retoques, barba y uso diario.',
  'Disponible máquina profesional para cortar pelo. Ideal para barbería o uso personal. Precio: 145.000 Gs. Consultar disponibilidad.',
  'Máquina profesional para cortar pelo Ecopower EP-2811. Producto nuevo en caja, carga USB, batería de litio, motor potente y cuchilla ajustable. Ideal para barbería o uso personal. Entrega disponible. Consultar stock.',
  '📦 PRODUCTO DISPONIBLE PARA REVENTA

Producto: Máquina profesional para cortar pelo Ecopower EP-2811
Precio mayorista: 85.000 Gs
Precio sugerido: 145.000 Gs
Posible ganancia: 60.000 Gs
Delivery no incluido. Consultar stock antes de vender.',
  'https://drive.google.com/'
)
on conflict (slug) do nothing;
