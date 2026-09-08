-- Camaraza Store V2.1: merchandising manual, categorias multiples y banners.
-- Ejecutar manualmente despues de 20260908_storefront_v2.sql.

begin;

create table if not exists public.retail_product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.retail_categories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id),
  constraint retail_product_categories_sort_order_check check (sort_order >= 0)
);

create index if not exists retail_product_categories_category_order_idx
  on public.retail_product_categories (category_id, sort_order, created_at, product_id);
create index if not exists retail_product_categories_product_idx
  on public.retail_product_categories (product_id, category_id);

insert into public.retail_product_categories (product_id, category_id, sort_order)
select d.product_id, d.retail_category_id, coalesce(d.retail_sort_order, 0)
from public.product_admin_details d
where d.retail_category_id is not null
on conflict (product_id, category_id) do nothing;

create table if not exists public.retail_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  button_text text,
  target_url text,
  mobile_image_url text not null,
  desktop_image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retail_banners_title_check check (btrim(title) <> ''),
  constraint retail_banners_mobile_image_check check (btrim(mobile_image_url) <> ''),
  constraint retail_banners_target_check check (
    target_url is null
    or btrim(target_url) = ''
    or (target_url ~ '^/' and target_url !~ '^//')
    or target_url ~* '^https?://'
  )
);

create index if not exists retail_banners_active_order_idx
  on public.retail_banners (is_active, sort_order, created_at);

create or replace function public.prepare_retail_banner_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := nullif(btrim(new.title), '');
  new.subtitle := nullif(btrim(coalesce(new.subtitle, '')), '');
  new.button_text := nullif(btrim(coalesce(new.button_text, '')), '');
  new.target_url := nullif(btrim(coalesce(new.target_url, '')), '');
  new.mobile_image_url := nullif(btrim(coalesce(new.mobile_image_url, '')), '');
  new.desktop_image_url := nullif(btrim(coalesce(new.desktop_image_url, '')), '');
  new.is_active := coalesce(new.is_active, true);
  new.sort_order := coalesce(new.sort_order, 0);
  new.updated_at := now();
  if new.title is null then raise exception 'Banner title is required'; end if;
  if new.mobile_image_url is null then raise exception 'Mobile banner image is required'; end if;
  if new.target_url is not null
     and (new.target_url !~ '^/' or new.target_url ~ '^//')
     and new.target_url !~* '^https?://' then
    raise exception 'Banner target must be an internal path or an HTTP(S) URL';
  end if;
  return new;
end;
$$;

drop trigger if exists retail_banners_prepare_row on public.retail_banners;
create trigger retail_banners_prepare_row
before insert or update on public.retail_banners
for each row execute function public.prepare_retail_banner_row();

alter table public.retail_product_categories enable row level security;
alter table public.retail_banners enable row level security;

drop policy if exists "Admins can read retail product categories" on public.retail_product_categories;
create policy "Admins can read retail product categories"
on public.retail_product_categories for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert retail product categories" on public.retail_product_categories;
create policy "Admins can insert retail product categories"
on public.retail_product_categories for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update retail product categories" on public.retail_product_categories;
create policy "Admins can update retail product categories"
on public.retail_product_categories for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete retail product categories" on public.retail_product_categories;
create policy "Admins can delete retail product categories"
on public.retail_product_categories for delete to authenticated
using (public.is_admin());

drop policy if exists "Admins can read retail banners" on public.retail_banners;
create policy "Admins can read retail banners"
on public.retail_banners for select to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert retail banners" on public.retail_banners;
create policy "Admins can insert retail banners"
on public.retail_banners for insert to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update retail banners" on public.retail_banners;
create policy "Admins can update retail banners"
on public.retail_banners for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete retail banners" on public.retail_banners;
create policy "Admins can delete retail banners"
on public.retail_banners for delete to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'retail-assets',
  'retail-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read retail assets" on storage.objects;
create policy "Public can read retail assets"
on storage.objects for select to public
using (bucket_id = 'retail-assets');

drop policy if exists "Admins can upload retail assets" on storage.objects;
create policy "Admins can upload retail assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'retail-assets'
  and (storage.foldername(name))[1] in ('categories', 'banners')
  and public.is_admin()
);

drop policy if exists "Admins can update retail assets" on storage.objects;
create policy "Admins can update retail assets"
on storage.objects for update to authenticated
using (bucket_id = 'retail-assets' and public.is_admin())
with check (
  bucket_id = 'retail-assets'
  and (storage.foldername(name))[1] in ('categories', 'banners')
  and public.is_admin()
);

drop policy if exists "Admins can delete retail assets" on storage.objects;
create policy "Admins can delete retail assets"
on storage.objects for delete to authenticated
using (bucket_id = 'retail-assets' and public.is_admin());

create or replace function public.admin_search_retail_products(
  p_category_id uuid,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Only active admins can search retail products'; end if;
  if not exists (select 1 from public.retail_categories rc where rc.id = p_category_id) then
    raise exception 'Retail category not found';
  end if;
  with filtered as (
    select
      p.id, p.name, p.slug, p.brand, p.model, p.main_image_url,
      d.sku, d.retail_price, d.publish_to_retail,
      (rpc.product_id is not null) as is_assigned,
      rpc.sort_order,
      count(*) over()::integer as total_count
    from public.products p
    join public.product_admin_details d on d.product_id = p.id
    left join public.retail_product_categories rpc
      on rpc.product_id = p.id and rpc.category_id = p_category_id
    where nullif(btrim(p_search), '') is null
       or position(lower(left(btrim(p_search), 80)) in lower(concat_ws(' ', p.name, p.brand, p.model, d.sku))) > 0
    order by (rpc.product_id is not null) desc, p.name, p.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(to_jsonb(f) order by f.is_assigned desc, f.name), '[]'::jsonb),
    'total', coalesce(max(f.total_count), 0),
    'assigned_total', (select count(*)::integer from public.retail_product_categories assigned where assigned.category_id = p_category_id)
  ) into v_result from filtered f;
  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'total', 0));
end;
$$;

create or replace function public.admin_get_retail_categories()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Only active admins can read retail categories'; end if;
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.home_sort_order, rows.name), '[]'::jsonb)
  into v_result
  from (
    select rc.*,
      (select count(*)::integer from public.retail_product_categories rpc where rpc.category_id = rc.id) product_count,
      (select count(*)::integer from public.retail_categories child where child.parent_id = rc.id) child_count
    from public.retail_categories rc
  ) rows;
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_retail_category_products(p_category_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Only active admins can read retail category products'; end if;
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.sort_order, rows.name), '[]'::jsonb)
  into v_result
  from (
    select rpc.product_id, rpc.category_id, rpc.sort_order, rpc.created_at,
      p.id, p.name, p.slug, p.brand, p.model, p.main_image_url,
      d.sku, d.retail_price, d.publish_to_retail
    from public.retail_product_categories rpc
    join public.products p on p.id = rpc.product_id
    join public.product_admin_details d on d.product_id = p.id
    where rpc.category_id = p_category_id
  ) rows;
  return coalesce(v_result, '[]'::jsonb);
end;
$$;

create or replace function public.admin_add_retail_category_products(
  p_category_id uuid,
  p_product_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Only active admins can assign retail products'; end if;
  if not exists (select 1 from public.retail_categories rc where rc.id = p_category_id) then
    raise exception 'Retail category not found';
  end if;
  if coalesce(cardinality(p_product_ids), 0) = 0 then return 0; end if;
  insert into public.retail_product_categories (product_id, category_id, sort_order)
  select ids.product_id, p_category_id,
    coalesce((select max(rpc.sort_order) + 1 from public.retail_product_categories rpc where rpc.category_id = p_category_id), 0)
      + ids.position::integer - 1
  from (
    select distinct on (u.product_id) u.product_id, u.position
    from unnest(p_product_ids) with ordinality as u(product_id, position)
    join public.products p on p.id = u.product_id
    order by u.product_id, u.position
  ) ids
  on conflict (product_id, category_id) do nothing;
  get diagnostics v_count = row_count;
  update public.product_admin_details d
  set retail_category_id = coalesce(d.retail_category_id, p_category_id), updated_at = now()
  where d.product_id = any(p_product_ids);
  return v_count;
end;
$$;

create or replace function public.admin_remove_retail_category_products(
  p_category_id uuid,
  p_product_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Only active admins can remove retail products'; end if;
  delete from public.retail_product_categories rpc
  where rpc.category_id = p_category_id and rpc.product_id = any(coalesce(p_product_ids, array[]::uuid[]));
  get diagnostics v_count = row_count;
  update public.product_admin_details d
  set retail_category_id = (
    select rpc.category_id from public.retail_product_categories rpc
    where rpc.product_id = d.product_id order by rpc.sort_order, rpc.created_at limit 1
  ), updated_at = now()
  where d.product_id = any(coalesce(p_product_ids, array[]::uuid[]))
    and d.retail_category_id = p_category_id;
  return v_count;
end;
$$;

create or replace function public.admin_update_retail_category_product_order(
  p_category_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Only active admins can order retail products'; end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'Items must be an array'; end if;
  with requested as (
    select x.product_id, greatest(x.sort_order, 0) as sort_order
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(product_id uuid, sort_order integer)
  )
  update public.retail_product_categories rpc
  set sort_order = requested.sort_order
  from requested
  where rpc.category_id = p_category_id and rpc.product_id = requested.product_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_set_retail_product_categories(
  p_product_id uuid,
  p_category_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'Only active admins can assign retail categories'; end if;
  if not exists (select 1 from public.products p where p.id = p_product_id) then raise exception 'Product not found'; end if;
  if exists (
    select 1 from unnest(coalesce(p_category_ids, array[]::uuid[])) requested(category_id)
    where not exists (select 1 from public.retail_categories rc where rc.id = requested.category_id)
  ) then raise exception 'One or more retail categories do not exist'; end if;
  delete from public.retail_product_categories rpc
  where rpc.product_id = p_product_id
    and not (rpc.category_id = any(coalesce(p_category_ids, array[]::uuid[])));
  insert into public.retail_product_categories (product_id, category_id, sort_order)
  select p_product_id, ids.category_id, ids.position::integer - 1
  from (
    select distinct on (u.category_id) u.category_id, u.position
    from unnest(coalesce(p_category_ids, array[]::uuid[])) with ordinality as u(category_id, position)
    join public.retail_categories rc on rc.id = u.category_id
    order by u.category_id, u.position
  ) ids
  on conflict (product_id, category_id) do nothing;
  get diagnostics v_count = row_count;
  update public.product_admin_details d
  set retail_category_id = (select u.category_id from unnest(coalesce(p_category_ids, array[]::uuid[])) with ordinality as u(category_id, position) order by u.position limit 1),
      updated_at = now()
  where d.product_id = p_product_id;
  return v_count;
end;
$$;

create or replace function public.get_retail_categories_v3()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(category_row) order by category_row.home_sort_order, category_row.name), '[]'::jsonb)
  from (
    select rc.id, rc.name, rc.slug, rc.parent_id, parent.name as parent_name, parent.slug as parent_slug,
      coalesce(rc.image_url, (
        select p.main_image_url
        from public.retail_product_categories rpc
        join public.products p on p.id = rpc.product_id
        join public.product_admin_details d on d.product_id = p.id
        where (rpc.category_id = rc.id or rpc.category_id in (select child.id from public.retail_categories child where child.parent_id = rc.id and child.is_active))
          and p.internal_status = 'active' and d.publish_to_retail and coalesce(d.retail_price, 0) > 0
          and p.main_image_url is not null
        order by rpc.sort_order, rpc.created_at limit 1
      )) as image_url,
      rc.show_on_home, rc.home_sort_order,
      (select count(distinct rpc.product_id)::integer
       from public.retail_product_categories rpc
       join public.products p on p.id = rpc.product_id
       join public.product_admin_details d on d.product_id = p.id
       where (rpc.category_id = rc.id or rpc.category_id in (select child.id from public.retail_categories child where child.parent_id = rc.id and child.is_active))
         and p.internal_status = 'active' and d.publish_to_retail and coalesce(d.retail_price, 0) > 0) as product_count
    from public.retail_categories rc
    left join public.retail_categories parent on parent.id = rc.parent_id and parent.is_active
    where rc.is_active
  ) category_row;
$$;

create or replace function public.get_retail_catalog_v3(
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
    select rc.id from public.retail_categories rc where rc.is_active and rc.slug = lower(nullif(btrim(p_category_slug), '')) limit 1
  ), ranked as (
    select distinct on (p.id)
      p.id, p.slug, p.name, p.brand, p.model, p.main_image_url,
      d.retail_price,
      case when d.retail_compare_at_price > d.retail_price then d.retail_compare_at_price else null end as retail_compare_at_price,
      greatest(coalesce(p.available_stock_quantity, 0), 0)::integer as available_stock_quantity,
      coalesce(d.track_inventory, true) as track_inventory,
      rc.name as category_name, rc.slug as category_slug, rc.parent_id,
      parent.name as parent_category_name, parent.slug as parent_category_slug,
      d.retail_featured, coalesce(rpc.sort_order, d.retail_sort_order, 0) as retail_sort_order,
      p.created_at
    from public.products p
    join public.product_admin_details d on d.product_id = p.id
    left join public.retail_product_categories rpc on rpc.product_id = p.id
    left join public.retail_categories rc on rc.id = rpc.category_id and rc.is_active
    left join public.retail_categories parent on parent.id = rc.parent_id and parent.is_active
    where p.internal_status = 'active' and d.publish_to_retail and coalesce(d.retail_price, 0) > 0
      and (not coalesce(p_available_only, false) or d.track_inventory = false or coalesce(p.available_stock_quantity, 0) > 0)
      and (p_min_price is null or d.retail_price >= greatest(p_min_price, 0))
      and (p_max_price is null or d.retail_price <= greatest(p_max_price, 0))
      and (
        nullif(btrim(p_category_slug), '') is null
        or rpc.category_id = (select id from selected_category)
        or rc.parent_id = (select id from selected_category)
      )
      and (
        nullif(btrim(p_search), '') is null
        or position(lower(left(btrim(p_search), 80)) in lower(concat_ws(' ', p.name, p.brand, p.model, rc.name, parent.name))) > 0
      )
    order by p.id,
      case when rpc.category_id = (select id from selected_category) then 0 else 1 end,
      coalesce(rpc.sort_order, d.retail_sort_order, 0), rpc.created_at
  )
  select coalesce(jsonb_agg(to_jsonb(ranked) order by
    case when p_order = 'price_asc' then ranked.retail_price end asc,
    case when p_order = 'price_desc' then ranked.retail_price end desc,
    case when p_order = 'newest' then ranked.created_at end desc,
    case when p_order not in ('price_asc', 'price_desc', 'newest') then ranked.retail_sort_order end asc,
    ranked.created_at desc
  ), '[]'::jsonb) from ranked;
$$;

create or replace function public.get_retail_home_v3()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with categories as (
    select * from jsonb_to_recordset(public.get_retail_categories_v3()) as c(
      id uuid, name text, slug text, parent_id uuid, parent_name text, parent_slug text,
      image_url text, show_on_home boolean, home_sort_order integer, product_count integer
    )
  ), featured as (
    select p.id, p.slug, p.name, p.brand, p.model, p.main_image_url, d.retail_price,
      case when d.retail_compare_at_price > d.retail_price then d.retail_compare_at_price else null end retail_compare_at_price,
      greatest(coalesce(p.available_stock_quantity, 0), 0)::integer available_stock_quantity,
      coalesce(d.track_inventory, true) track_inventory, d.retail_sort_order, p.created_at
    from public.products p join public.product_admin_details d on d.product_id = p.id
    where p.internal_status = 'active' and d.publish_to_retail and d.retail_featured and coalesce(d.retail_price, 0) > 0
    order by d.retail_sort_order desc, p.created_at desc limit 12
  )
  select jsonb_build_object(
    'banner', (select to_jsonb(b) from (select rb.id, rb.title, rb.subtitle, rb.button_text, rb.target_url, rb.mobile_image_url, rb.desktop_image_url from public.retail_banners rb where rb.is_active order by rb.sort_order, rb.created_at limit 1) b),
    'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.home_sort_order, c.name) from categories c where c.product_count > 0), '[]'::jsonb),
    'featured', coalesce((select jsonb_agg(to_jsonb(f) order by f.retail_sort_order desc, f.created_at desc) from featured f), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'image_url', c.image_url,
        'products', coalesce((
          select jsonb_agg(to_jsonb(cp) order by cp.retail_sort_order, cp.created_at desc)
          from (select * from jsonb_to_recordset(public.get_retail_catalog_v3(c.slug, null, null, null, false, 'relevant')) as x(
            id uuid, slug text, name text, brand text, model text, main_image_url text,
            retail_price numeric, retail_compare_at_price numeric, available_stock_quantity integer,
            track_inventory boolean, category_name text, category_slug text, parent_id uuid,
            parent_category_name text, parent_category_slug text, retail_featured boolean,
            retail_sort_order integer, created_at timestamptz
          ) limit 12) cp
        ), '[]'::jsonb)
      ) order by c.home_sort_order, c.name)
      from categories c where c.show_on_home and c.product_count > 0
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_retail_product_v3(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with product as (
    select p.id, p.slug, p.name, p.brand, p.model,
      coalesce(nullif(p.short_description, ''), nullif(p.long_description, '')) public_description,
      p.warranty, p.delivery_time, coalesce(p.delivery_included, false) delivery_included, p.main_image_url,
      coalesce((select jsonb_agg(jsonb_build_object('id', pi.id, 'image_url', pi.image_url, 'sort_order', pi.sort_order) order by pi.sort_order, pi.created_at) from public.product_images pi where pi.product_id = p.id), '[]'::jsonb) gallery_images,
      d.retail_price, case when d.retail_compare_at_price > d.retail_price then d.retail_compare_at_price else null end retail_compare_at_price,
      greatest(coalesce(p.available_stock_quantity, 0), 0)::integer available_stock_quantity,
      coalesce(d.track_inventory, true) track_inventory, p.created_at,
      coalesce((select jsonb_agg(jsonb_build_object('name', rc.name, 'slug', rc.slug, 'parent_name', parent.name, 'parent_slug', parent.slug) order by rpc.sort_order, rc.name)
        from public.retail_product_categories rpc
        join public.retail_categories rc on rc.id = rpc.category_id and rc.is_active
        left join public.retail_categories parent on parent.id = rc.parent_id and parent.is_active
        where rpc.product_id = p.id), '[]'::jsonb) categories
    from public.products p join public.product_admin_details d on d.product_id = p.id
    where p.slug = p_slug and p.internal_status = 'active' and d.publish_to_retail and coalesce(d.retail_price, 0) > 0
    limit 1
  )
  select case when not exists (select 1 from product) then null else jsonb_build_object(
    'product', (select to_jsonb(product) from product),
    'related', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select catalog.* from product p
      join lateral jsonb_to_recordset(public.get_retail_catalog_v3(null, null, null, null, false, 'relevant')) as catalog(
        id uuid, slug text, name text, brand text, model text, main_image_url text,
        retail_price numeric, retail_compare_at_price numeric, available_stock_quantity integer,
        track_inventory boolean, category_name text, category_slug text, parent_id uuid,
        parent_category_name text, parent_category_slug text, retail_featured boolean,
        retail_sort_order integer, created_at timestamptz
      ) on catalog.id <> p.id
      where exists (
        select 1 from public.retail_product_categories a
        join public.retail_product_categories b on b.category_id = a.category_id
        where a.product_id = p.id and b.product_id = catalog.id
      ) limit 12
    ) r), '[]'::jsonb)
  ) end;
$$;

alter function public.prepare_retail_banner_row() owner to postgres;
alter function public.admin_search_retail_products(uuid, text, integer, integer) owner to postgres;
alter function public.admin_get_retail_categories() owner to postgres;
alter function public.admin_get_retail_category_products(uuid) owner to postgres;
alter function public.admin_add_retail_category_products(uuid, uuid[]) owner to postgres;
alter function public.admin_remove_retail_category_products(uuid, uuid[]) owner to postgres;
alter function public.admin_update_retail_category_product_order(uuid, jsonb) owner to postgres;
alter function public.admin_set_retail_product_categories(uuid, uuid[]) owner to postgres;
alter function public.get_retail_categories_v3() owner to postgres;
alter function public.get_retail_catalog_v3(text, text, numeric, numeric, boolean, text) owner to postgres;
alter function public.get_retail_home_v3() owner to postgres;
alter function public.get_retail_product_v3(text) owner to postgres;

revoke all on function public.prepare_retail_banner_row() from public, anon, authenticated;
revoke all on function public.admin_search_retail_products(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_get_retail_categories() from public, anon, authenticated;
revoke all on function public.admin_get_retail_category_products(uuid) from public, anon, authenticated;
revoke all on function public.admin_add_retail_category_products(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.admin_remove_retail_category_products(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.admin_update_retail_category_product_order(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_set_retail_product_categories(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.get_retail_categories_v3() from public, anon, authenticated;
revoke all on function public.get_retail_catalog_v3(text, text, numeric, numeric, boolean, text) from public, anon, authenticated;
revoke all on function public.get_retail_home_v3() from public, anon, authenticated;
revoke all on function public.get_retail_product_v3(text) from public, anon, authenticated;

grant execute on function public.admin_search_retail_products(uuid, text, integer, integer) to authenticated;
grant execute on function public.admin_get_retail_categories() to authenticated;
grant execute on function public.admin_get_retail_category_products(uuid) to authenticated;
grant execute on function public.admin_add_retail_category_products(uuid, uuid[]) to authenticated;
grant execute on function public.admin_remove_retail_category_products(uuid, uuid[]) to authenticated;
grant execute on function public.admin_update_retail_category_product_order(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_retail_product_categories(uuid, uuid[]) to authenticated;
grant execute on function public.get_retail_categories_v3() to anon, authenticated;
grant execute on function public.get_retail_catalog_v3(text, text, numeric, numeric, boolean, text) to anon, authenticated;
grant execute on function public.get_retail_home_v3() to anon, authenticated;
grant execute on function public.get_retail_product_v3(text) to anon, authenticated;

revoke all on public.retail_product_categories from public, anon, authenticated;
revoke all on public.retail_banners from public, anon, authenticated;
grant select, insert, update, delete on public.retail_product_categories to authenticated;
grant select, insert, update, delete on public.retail_banners to authenticated;

notify pgrst, 'reload schema';

commit;
