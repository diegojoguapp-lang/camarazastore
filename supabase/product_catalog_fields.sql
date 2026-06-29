-- Campos de merchandising y orden manual para el catalogo.
-- Ejecutar una vez en Supabase SQL Editor antes de desplegar el frontend.

alter table public.products
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_priority integer not null default 0;

create index if not exists products_catalog_order_idx
  on public.products (sort_priority desc, created_at desc);
