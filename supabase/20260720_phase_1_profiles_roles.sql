-- Camaraza Store Re-venta - Fase 1: perfiles, roles y RLS por admin.
-- Ejecutar manualmente en Supabase SQL Editor.
-- No crea ventas, comisiones, pagos, finanzas, clientes ni usuarios.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  reseller_code text unique,
  role text not null check (role in ('admin', 'reseller')),
  full_name text,
  phone text,
  city text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_is_active_idx on public.profiles(is_active);
create index if not exists profiles_reseller_code_idx on public.profiles(reseller_code);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.help_videos enable row level security;
alter table public.social_links enable row level security;

insert into public.profiles (
  id,
  role,
  full_name,
  is_active,
  updated_at
)
values (
  'baad9301-c830-4640-82cc-d6a311ab964b',
  'admin',
  'Diego Camaraza',
  true,
  now()
)
on conflict (id) do update
set
  role = 'admin',
  full_name = excluded.full_name,
  is_active = true,
  updated_at = now();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  )
$$;

alter function public.is_admin() owner to postgres;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- profiles RLS
-- ============================================================

drop policy if exists "Profiles admins can read all" on public.profiles;
create policy "Profiles admins can read all"
on public.profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "Profiles users can read own profile" on public.profiles;
create policy "Profiles users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Profiles admins can insert" on public.profiles;
create policy "Profiles admins can insert"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Profiles admins can update" on public.profiles;
create policy "Profiles admins can update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- No delete policy in this phase: profiles should be deactivated with is_active.

-- ============================================================
-- products RLS: keep public read, restrict admin actions to is_admin().
-- ============================================================

drop policy if exists "products_public_read" on public.products;
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products
for select
using (internal_status = 'active');

drop policy if exists "products_admin_read_all" on public.products;
drop policy if exists "products_admin_write" on public.products;
drop policy if exists "Authenticated can read all products" on public.products;
drop policy if exists "Authenticated can insert products" on public.products;
drop policy if exists "Authenticated can update products" on public.products;
drop policy if exists "Authenticated can delete products" on public.products;

drop policy if exists "Admins can read all products" on public.products;
create policy "Admins can read all products"
on public.products
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products
for delete
to authenticated
using (public.is_admin());

-- ============================================================
-- product_images RLS: keep public read, restrict admin writes to is_admin().
-- ============================================================

drop policy if exists "images_public_read" on public.product_images;
drop policy if exists "Public can read product images" on public.product_images;
create policy "Public can read product images"
on public.product_images
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.internal_status = 'active'
  )
);

drop policy if exists "images_admin_write" on public.product_images;
drop policy if exists "Authenticated can read all product images" on public.product_images;
drop policy if exists "Authenticated can insert product images" on public.product_images;
drop policy if exists "Authenticated can update product images" on public.product_images;
drop policy if exists "Authenticated can delete product images" on public.product_images;

drop policy if exists "Admins can read all product images" on public.product_images;
create policy "Admins can read all product images"
on public.product_images
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert product images" on public.product_images;
create policy "Admins can insert product images"
on public.product_images
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update product images" on public.product_images;
create policy "Admins can update product images"
on public.product_images
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete product images" on public.product_images;
create policy "Admins can delete product images"
on public.product_images
for delete
to authenticated
using (public.is_admin());

-- ============================================================
-- help_videos RLS: keep visible videos public, restrict admin actions.
-- ============================================================

drop policy if exists "Public can read visible help videos" on public.help_videos;
create policy "Public can read visible help videos"
on public.help_videos
for select
using (is_visible = true);

drop policy if exists "Authenticated can read all help videos" on public.help_videos;
drop policy if exists "Authenticated can insert help videos" on public.help_videos;
drop policy if exists "Authenticated can update help videos" on public.help_videos;
drop policy if exists "Authenticated can delete help videos" on public.help_videos;

drop policy if exists "Admins can read all help videos" on public.help_videos;
create policy "Admins can read all help videos"
on public.help_videos
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert help videos" on public.help_videos;
create policy "Admins can insert help videos"
on public.help_videos
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update help videos" on public.help_videos;
create policy "Admins can update help videos"
on public.help_videos
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete help videos" on public.help_videos;
create policy "Admins can delete help videos"
on public.help_videos
for delete
to authenticated
using (public.is_admin());

-- ============================================================
-- social_links RLS: keep public read, restrict admin management.
-- ============================================================

drop policy if exists "Public can read social links" on public.social_links;
create policy "Public can read social links"
on public.social_links
for select
using (true);

drop policy if exists "Authenticated can manage social links" on public.social_links;

drop policy if exists "Admins can insert social links" on public.social_links;
create policy "Admins can insert social links"
on public.social_links
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update social links" on public.social_links;
create policy "Admins can update social links"
on public.social_links
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete social links" on public.social_links;
create policy "Admins can delete social links"
on public.social_links
for delete
to authenticated
using (public.is_admin());

-- ============================================================
-- Storage RLS for bucket product-images.
-- ============================================================

drop policy if exists "storage_public_read" on storage.objects;
drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects
for select
using (bucket_id = 'product-images');

drop policy if exists "storage_admin_write" on storage.objects;
drop policy if exists "Authenticated can upload product images" on storage.objects;
drop policy if exists "Authenticated can update product images storage" on storage.objects;
drop policy if exists "Authenticated can delete product images storage" on storage.objects;

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can update product images storage" on storage.objects;
create policy "Admins can update product images storage"
on storage.objects
for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images storage" on storage.objects;
create policy "Admins can delete product images storage"
on storage.objects
for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

notify pgrst, 'reload schema';

commit;
