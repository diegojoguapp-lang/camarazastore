-- Camaraza Store V2: taxonomia retail y contratos publicos sanitizados.
-- Ejecutar manualmente despues de las migraciones historicas del proyecto.

begin;

create table if not exists public.retail_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  parent_id uuid references public.retail_categories(id) on delete restrict,
  image_url text,
  is_active boolean not null default true,
  show_on_home boolean not null default false,
  home_sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retail_categories_name_check check (btrim(name) <> ''),
  constraint retail_categories_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint retail_categories_parent_check check (parent_id is null or parent_id <> id)
);

create unique index if not exists retail_categories_slug_unique_idx
  on public.retail_categories (lower(slug));
create index if not exists retail_categories_parent_idx
  on public.retail_categories (parent_id, is_active, home_sort_order, name);
create index if not exists retail_categories_home_idx
  on public.retail_categories (show_on_home, is_active, home_sort_order, name);

alter table public.product_admin_details
  add column if not exists retail_category_id uuid references public.retail_categories(id) on delete set null,
  add column if not exists retail_featured boolean not null default false,
  add column if not exists retail_compare_at_price numeric(14,2),
  add column if not exists retail_sort_order integer not null default 0;

alter table public.product_admin_details
  drop constraint if exists product_admin_details_retail_v2_check;
alter table public.product_admin_details
  add constraint product_admin_details_retail_v2_check check (
    retail_compare_at_price is null or retail_compare_at_price >= 0
  );

create index if not exists product_admin_details_retail_category_idx
  on public.product_admin_details (retail_category_id, publish_to_retail, retail_sort_order desc);
create index if not exists product_admin_details_retail_featured_idx
  on public.product_admin_details (retail_featured, publish_to_retail, retail_sort_order desc)
  where retail_featured = true;

create or replace function public.prepare_retail_category_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := nullif(btrim(new.name), '');
  new.slug := lower(regexp_replace(regexp_replace(btrim(coalesce(new.slug, '')), '[^a-zA-Z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'));
  new.image_url := nullif(btrim(coalesce(new.image_url, '')), '');
  new.is_active := coalesce(new.is_active, true);
  new.show_on_home := coalesce(new.show_on_home, false);
  new.home_sort_order := coalesce(new.home_sort_order, 0);
  new.updated_at := now();
  if new.name is null then raise exception 'Category name is required'; end if;
  if new.slug = '' then raise exception 'Category slug is required'; end if;
  if new.parent_id is not null and exists (
    select 1 from public.retail_categories rc
    where rc.id = new.parent_id and rc.parent_id is not null
  ) then
    raise exception 'Only one subcategory level is allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists retail_categories_prepare_row on public.retail_categories;
create trigger retail_categories_prepare_row
before insert or update on public.retail_categories
for each row execute function public.prepare_retail_category_row();

alter table public.retail_categories enable row level security;

drop policy if exists "Admins can read retail categories" on public.retail_categories;
create policy "Admins can read retail categories"
on public.retail_categories for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert retail categories" on public.retail_categories;
create policy "Admins can insert retail categories"
on public.retail_categories for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update retail categories" on public.retail_categories;
create policy "Admins can update retail categories"
on public.retail_categories for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete retail categories" on public.retail_categories;
create policy "Admins can delete retail categories"
on public.retail_categories for delete to authenticated
using (public.is_admin());

create or replace function public.get_retail_categories_v2()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(category_row) order by category_row.home_sort_order, category_row.name), '[]'::jsonb)
  from (
    select
      rc.id,
      rc.name,
      rc.slug,
      rc.parent_id,
      parent.name as parent_name,
      parent.slug as parent_slug,
      coalesce(rc.image_url, (
        select p.main_image_url
        from public.products p
        join public.product_admin_details d on d.product_id = p.id
        where (d.retail_category_id = rc.id or d.retail_category_id in (
            select child.id from public.retail_categories child where child.parent_id = rc.id and child.is_active = true
          ))
          and d.publish_to_retail = true
          and p.internal_status = 'active'
          and coalesce(d.retail_price, 0) > 0
          and (d.track_inventory = false or coalesce(p.available_stock_quantity, 0) > 0)
          and p.main_image_url is not null
        order by d.retail_sort_order desc, p.created_at desc
        limit 1
      )) as image_url,
      rc.show_on_home,
      rc.home_sort_order,
      (select count(*)::integer
       from public.products p
       join public.product_admin_details d on d.product_id = p.id
       where p.internal_status = 'active'
         and d.publish_to_retail = true
         and coalesce(d.retail_price, 0) > 0
         and (d.track_inventory = false or coalesce(p.available_stock_quantity, 0) > 0)
         and (d.retail_category_id = rc.id or d.retail_category_id in (
           select child.id from public.retail_categories child where child.parent_id = rc.id and child.is_active = true
         ))) as product_count
    from public.retail_categories rc
    left join public.retail_categories parent on parent.id = rc.parent_id
    where rc.is_active = true
    union all
    select
      null::uuid, 'Otros'::text, 'otros'::text, null::uuid, null::text, null::text,
      (select p.main_image_url from public.products p join public.product_admin_details d on d.product_id = p.id
       where d.retail_category_id is null and d.publish_to_retail = true and p.internal_status = 'active'
         and coalesce(d.retail_price, 0) > 0 and (d.track_inventory = false or coalesce(p.available_stock_quantity, 0) > 0)
       order by p.created_at desc limit 1),
      false, 2147483647,
      (select count(*)::integer from public.products p join public.product_admin_details d on d.product_id = p.id
       where d.retail_category_id is null and d.publish_to_retail = true and p.internal_status = 'active'
         and coalesce(d.retail_price, 0) > 0 and (d.track_inventory = false or coalesce(p.available_stock_quantity, 0) > 0))
  ) category_row;
$$;

create or replace function public.get_retail_catalog_v2(
  p_category_slug text default null,
  p_search text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_available_only boolean default false,
  p_order text default 'relevant'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_category as (
    select rc.id from public.retail_categories rc
    where rc.is_active = true and rc.slug = lower(nullif(btrim(p_category_slug), ''))
    limit 1
  ), rows as (
    select
      p.id, p.slug, p.name, p.brand, p.model, p.main_image_url,
      d.retail_price,
      case when d.retail_compare_at_price > d.retail_price then d.retail_compare_at_price else null end as retail_compare_at_price,
      greatest(coalesce(p.available_stock_quantity, 0), 0)::integer as available_stock_quantity,
      coalesce(d.track_inventory, true) as track_inventory,
      coalesce(rc.name, 'Otros') as category_name,
      coalesce(rc.slug, 'otros') as category_slug,
      rc.parent_id,
      parent.name as parent_category_name,
      parent.slug as parent_category_slug,
      d.retail_featured,
      d.retail_sort_order,
      p.created_at
    from public.products p
    join public.product_admin_details d on d.product_id = p.id
    left join public.retail_categories rc on rc.id = d.retail_category_id and rc.is_active = true
    left join public.retail_categories parent on parent.id = rc.parent_id and parent.is_active = true
    where p.internal_status = 'active'
      and d.publish_to_retail = true
      and coalesce(d.retail_price, 0) > 0
      and (d.track_inventory = false or greatest(coalesce(p.available_stock_quantity, 0), 0) > 0)
      and (not coalesce(p_available_only, false) or d.track_inventory = false or coalesce(p.available_stock_quantity, 0) > 0)
      and (p_min_price is null or d.retail_price >= greatest(p_min_price, 0))
      and (p_max_price is null or d.retail_price <= greatest(p_max_price, 0))
      and (
        nullif(btrim(p_category_slug), '') is null
        or (lower(p_category_slug) = 'otros' and d.retail_category_id is null)
        or d.retail_category_id = (select id from selected_category)
        or rc.parent_id = (select id from selected_category)
      )
      and (
        nullif(btrim(p_search), '') is null
        or position(lower(left(btrim(p_search), 80)) in lower(concat_ws(' ', p.name, p.brand, p.model, rc.name, parent.name))) > 0
      )
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by
    case when p_order = 'price_asc' then rows.retail_price end asc,
    case when p_order = 'price_desc' then rows.retail_price end desc,
    case when p_order = 'newest' then rows.created_at end desc,
    case when p_order not in ('price_asc', 'price_desc', 'newest') then rows.retail_sort_order end desc,
    rows.created_at desc
  ), '[]'::jsonb) from rows;
$$;

create or replace function public.get_retail_home_v2()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with products as (
    select * from jsonb_to_recordset(public.get_retail_catalog_v2()) as p(
      id uuid, slug text, name text, brand text, model text, main_image_url text,
      retail_price numeric, retail_compare_at_price numeric, available_stock_quantity integer,
      track_inventory boolean, category_name text, category_slug text, parent_id uuid,
      parent_category_name text, parent_category_slug text, retail_featured boolean,
      retail_sort_order integer, created_at timestamptz
    )
  ), categories as (
    select * from jsonb_to_recordset(public.get_retail_categories_v2()) as c(
      id uuid, name text, slug text, parent_id uuid, parent_name text, parent_slug text,
      image_url text, show_on_home boolean, home_sort_order integer, product_count integer
    )
  )
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.home_sort_order, c.name) from categories c where c.product_count > 0), '[]'::jsonb),
    'featured', coalesce((select jsonb_agg(to_jsonb(p) order by p.retail_sort_order desc, p.created_at desc) from (select * from products where retail_featured = true order by retail_sort_order desc, created_at desc limit 12) p), '[]'::jsonb),
    'new_products', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from (select * from products order by created_at desc limit 12) p), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'image_url', c.image_url,
        'products', (select coalesce(jsonb_agg(to_jsonb(cp) order by cp.retail_sort_order desc, cp.created_at desc), '[]'::jsonb)
          from (select * from products p where p.category_slug = c.slug or p.parent_category_slug = c.slug order by p.retail_sort_order desc, p.created_at desc limit 12) cp)
      ) order by c.home_sort_order, c.name)
      from categories c where c.show_on_home = true and c.product_count > 0
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_retail_product_v2(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with product as (
    select
      p.id, p.slug, p.name, p.brand, p.model,
      coalesce(nullif(p.short_description, ''), nullif(p.long_description, '')) as public_description,
      p.warranty, p.delivery_time, coalesce(p.delivery_included, false) as delivery_included,
      p.main_image_url,
      coalesce((select jsonb_agg(jsonb_build_object('id', pi.id, 'image_url', pi.image_url, 'sort_order', pi.sort_order) order by pi.sort_order, pi.created_at)
        from public.product_images pi where pi.product_id = p.id), '[]'::jsonb) as gallery_images,
      d.retail_price,
      case when d.retail_compare_at_price > d.retail_price then d.retail_compare_at_price else null end as retail_compare_at_price,
      greatest(coalesce(p.available_stock_quantity, 0), 0)::integer as available_stock_quantity,
      coalesce(d.track_inventory, true) as track_inventory,
      coalesce(rc.name, 'Otros') as category_name,
      coalesce(rc.slug, 'otros') as category_slug,
      parent.name as parent_category_name, parent.slug as parent_category_slug,
      p.created_at
    from public.products p
    join public.product_admin_details d on d.product_id = p.id
    left join public.retail_categories rc on rc.id = d.retail_category_id and rc.is_active = true
    left join public.retail_categories parent on parent.id = rc.parent_id and parent.is_active = true
    where p.slug = p_slug and p.internal_status = 'active' and d.publish_to_retail = true
      and coalesce(d.retail_price, 0) > 0
      and (d.track_inventory = false or greatest(coalesce(p.available_stock_quantity, 0), 0) > 0)
    limit 1
  )
  select case when not exists (select 1 from product) then null else jsonb_build_object(
    'product', (select to_jsonb(product) from product),
    'related', coalesce((select jsonb_agg(to_jsonb(r) order by r.retail_sort_order desc, r.created_at desc)
      from (select c.* from jsonb_to_recordset(public.get_retail_catalog_v2()) as c(
        id uuid, slug text, name text, brand text, model text, main_image_url text,
        retail_price numeric, retail_compare_at_price numeric, available_stock_quantity integer,
        track_inventory boolean, category_name text, category_slug text, parent_id uuid,
        parent_category_name text, parent_category_slug text, retail_featured boolean,
        retail_sort_order integer, created_at timestamptz
      ), product p
       where c.id <> p.id and (c.category_slug = p.category_slug or (p.parent_category_slug is not null and c.parent_category_slug = p.parent_category_slug))
       order by c.retail_sort_order desc, c.created_at desc
       limit 12) r), '[]'::jsonb)
  ) end;
$$;

alter function public.prepare_retail_category_row() owner to postgres;
alter function public.get_retail_categories_v2() owner to postgres;
alter function public.get_retail_catalog_v2(text, text, numeric, numeric, boolean, text) owner to postgres;
alter function public.get_retail_home_v2() owner to postgres;
alter function public.get_retail_product_v2(text) owner to postgres;

revoke all on function public.prepare_retail_category_row() from public, anon, authenticated;
revoke all on function public.get_retail_categories_v2() from public, anon, authenticated;
revoke all on function public.get_retail_catalog_v2(text, text, numeric, numeric, boolean, text) from public, anon, authenticated;
revoke all on function public.get_retail_home_v2() from public, anon, authenticated;
revoke all on function public.get_retail_product_v2(text) from public, anon, authenticated;
grant execute on function public.get_retail_categories_v2() to anon, authenticated;
grant execute on function public.get_retail_catalog_v2(text, text, numeric, numeric, boolean, text) to anon, authenticated;
grant execute on function public.get_retail_home_v2() to anon, authenticated;
grant execute on function public.get_retail_product_v2(text) to anon, authenticated;

revoke all on public.retail_categories from public, anon, authenticated;
grant select, insert, update, delete on public.retail_categories to authenticated;

notify pgrst, 'reload schema';

commit;
