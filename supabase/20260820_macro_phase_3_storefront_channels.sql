begin;

alter table public.product_admin_details
  add column if not exists publish_to_retail boolean not null default false,
  add column if not exists publish_to_resellers boolean not null default true;

update public.product_admin_details
set
  publish_to_retail = coalesce(publish_to_retail, false),
  publish_to_resellers = coalesce(publish_to_resellers, true);

alter table public.product_admin_details drop constraint if exists product_admin_details_values_check;
alter table public.product_admin_details
  add constraint product_admin_details_values_check check (
    (retail_price is null or retail_price >= 0)
    and reseller_commission_amount >= 0
    and low_stock_threshold >= 0
    and (publish_to_retail = false or coalesce(retail_price, 0) > 0)
  );

create index if not exists product_admin_details_channels_idx
  on public.product_admin_details (publish_to_retail, publish_to_resellers);

drop policy if exists "Public can read active products" on public.products;

drop policy if exists "Public can read product images" on public.product_images;
create policy "Public can read product images"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    join public.product_admin_details d on d.product_id = p.id
    where p.id = product_images.product_id
      and p.internal_status = 'active'
      and (d.publish_to_retail = true or d.publish_to_resellers = true)
  )
);

drop function if exists public.get_retail_catalog();
create function public.get_retail_catalog()
returns table (
  id uuid,
  slug text,
  name text,
  brand text,
  model text,
  category text,
  public_description text,
  warranty text,
  delivery_time text,
  delivery_included boolean,
  main_image_url text,
  gallery_images jsonb,
  retail_price numeric,
  available_stock_quantity integer,
  track_inventory boolean,
  stock_label text,
  is_featured boolean,
  sort_priority integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.slug,
    p.name,
    p.brand,
    p.model,
    p.category,
    coalesce(nullif(p.short_description, ''), nullif(p.long_description, '')) as public_description,
    p.warranty,
    p.delivery_time,
    coalesce(p.delivery_included, false) as delivery_included,
    p.main_image_url,
    coalesce((
      select jsonb_agg(jsonb_build_object('image_url', pi.image_url, 'sort_order', pi.sort_order) order by pi.sort_order asc, pi.created_at asc)
      from public.product_images pi
      where pi.product_id = p.id
    ), '[]'::jsonb) as gallery_images,
    d.retail_price,
    greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::integer as available_stock_quantity,
    coalesce(d.track_inventory, true) as track_inventory,
    case
      when coalesce(d.track_inventory, true) = false then 'Disponible'
      else greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::text || ' disponibles'
    end as stock_label,
    coalesce(p.is_featured, false) as is_featured,
    coalesce(p.sort_priority, 0) as sort_priority,
    p.created_at
  from public.products p
  join public.product_admin_details d on d.product_id = p.id
  where p.internal_status = 'active'
    and d.publish_to_retail = true
    and coalesce(d.retail_price, 0) > 0
    and (
      coalesce(d.track_inventory, true) = false
      or greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0) > 0
    )
  order by coalesce(p.sort_priority, 0) desc, p.created_at desc;
$$;

drop function if exists public.get_retail_product(text);
create function public.get_retail_product(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  brand text,
  model text,
  category text,
  public_description text,
  warranty text,
  delivery_time text,
  delivery_included boolean,
  delivery_note text,
  main_image_url text,
  gallery_images jsonb,
  retail_price numeric,
  available_stock_quantity integer,
  track_inventory boolean,
  stock_label text,
  is_featured boolean,
  sort_priority integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.slug,
    p.name,
    p.brand,
    p.model,
    p.category,
    coalesce(nullif(p.long_description, ''), nullif(p.short_description, '')) as public_description,
    p.warranty,
    p.delivery_time,
    coalesce(p.delivery_included, false) as delivery_included,
    p.delivery_note,
    p.main_image_url,
    coalesce((
      select jsonb_agg(jsonb_build_object('image_url', pi.image_url, 'sort_order', pi.sort_order) order by pi.sort_order asc, pi.created_at asc)
      from public.product_images pi
      where pi.product_id = p.id
    ), '[]'::jsonb) as gallery_images,
    d.retail_price,
    greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::integer as available_stock_quantity,
    coalesce(d.track_inventory, true) as track_inventory,
    case
      when coalesce(d.track_inventory, true) = false then 'Disponible'
      else greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::text || ' disponibles'
    end as stock_label,
    coalesce(p.is_featured, false) as is_featured,
    coalesce(p.sort_priority, 0) as sort_priority,
    p.created_at
  from public.products p
  join public.product_admin_details d on d.product_id = p.id
  where p.slug = p_slug
    and p.internal_status = 'active'
    and d.publish_to_retail = true
    and coalesce(d.retail_price, 0) > 0
    and (
      coalesce(d.track_inventory, true) = false
      or greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0) > 0
    )
  limit 1;
$$;

drop function if exists public.validate_retail_cart(jsonb);
create function public.validate_retail_cart(p_items jsonb)
returns table (
  id uuid,
  slug text,
  name text,
  brand text,
  model text,
  main_image_url text,
  retail_price numeric,
  available_stock_quantity integer,
  track_inventory boolean,
  requested_quantity integer,
  is_available boolean,
  issue text
)
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select
      item.product_id,
      greatest(coalesce(item.quantity, 0), 0)::integer as quantity
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(product_id uuid, quantity integer)
  )
  select
    p.id,
    p.slug,
    p.name,
    p.brand,
    p.model,
    p.main_image_url,
    d.retail_price,
    greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::integer as available_stock_quantity,
    coalesce(d.track_inventory, true) as track_inventory,
    r.quantity as requested_quantity,
    (
      p.internal_status = 'active'
      and d.publish_to_retail = true
      and coalesce(d.retail_price, 0) > 0
      and r.quantity > 0
      and (
        coalesce(d.track_inventory, true) = false
        or greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0) >= r.quantity
      )
    ) as is_available,
    case
      when p.id is null then 'Producto no encontrado'
      when p.internal_status <> 'active' or d.publish_to_retail is distinct from true then 'Producto no disponible'
      when coalesce(d.retail_price, 0) <= 0 then 'Producto sin precio vigente'
      when r.quantity <= 0 then 'Cantidad invalida'
      when coalesce(d.track_inventory, true) = true
        and greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0) <= 0 then 'Producto sin stock'
      when coalesce(d.track_inventory, true) = true
        and greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0) < r.quantity then 'Stock insuficiente'
      else null
    end as issue
  from requested r
  left join public.products p on p.id = r.product_id
  left join public.product_admin_details d on d.product_id = p.id;
$$;

drop function if exists public.get_reseller_catalog();
create function public.get_reseller_catalog()
returns table (
  id uuid,
  name text,
  slug text,
  brand text,
  model text,
  category text,
  internal_status text,
  public_stock_status text,
  wholesale_price numeric,
  suggested_price numeric,
  main_image_url text,
  is_featured boolean,
  sort_priority integer,
  created_at timestamptz,
  available_stock_quantity integer,
  track_inventory boolean,
  stock_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.brand,
    p.model,
    p.category,
    p.internal_status,
    p.public_stock_status,
    p.wholesale_price,
    p.suggested_price,
    p.main_image_url,
    coalesce(p.is_featured, false) as is_featured,
    coalesce(p.sort_priority, 0) as sort_priority,
    p.created_at,
    greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::integer as available_stock_quantity,
    coalesce(d.track_inventory, true) as track_inventory,
    case
      when coalesce(d.track_inventory, true) = false then 'Disponible'
      else greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::text || ' disponibles'
    end as stock_label
  from public.products p
  join public.product_admin_details d on d.product_id = p.id
  where p.internal_status = 'active'
    and d.publish_to_resellers = true
    and (
      coalesce(d.track_inventory, true) = false
      or greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0) > 0
    )
  order by coalesce(p.sort_priority, 0) desc, p.created_at desc;
$$;

drop function if exists public.get_reseller_product(text);
create function public.get_reseller_product(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  brand text,
  model text,
  category text,
  internal_status text,
  public_stock_status text,
  wholesale_price numeric,
  suggested_price numeric,
  delivery_time text,
  delivery_included boolean,
  delivery_note text,
  warranty text,
  return_policy text,
  long_description text,
  reseller_group_text text,
  custom_whatsapp_message text,
  drive_link text,
  video_url text,
  main_image_url text,
  images jsonb,
  is_featured boolean,
  sort_priority integer,
  created_at timestamptz,
  available_stock_quantity integer,
  track_inventory boolean,
  stock_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.slug,
    p.brand,
    p.model,
    p.category,
    p.internal_status,
    p.public_stock_status,
    p.wholesale_price,
    p.suggested_price,
    p.delivery_time,
    coalesce(p.delivery_included, false) as delivery_included,
    p.delivery_note,
    p.warranty,
    p.return_policy,
    p.long_description,
    p.reseller_group_text,
    p.custom_whatsapp_message,
    p.drive_link,
    p.video_url,
    p.main_image_url,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', pi.id, 'image_url', pi.image_url, 'sort_order', pi.sort_order) order by pi.sort_order asc, pi.created_at asc)
      from public.product_images pi
      where pi.product_id = p.id
    ), '[]'::jsonb) as images,
    coalesce(p.is_featured, false) as is_featured,
    coalesce(p.sort_priority, 0) as sort_priority,
    p.created_at,
    greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::integer as available_stock_quantity,
    coalesce(d.track_inventory, true) as track_inventory,
    case
      when coalesce(d.track_inventory, true) = false then 'Disponible'
      else greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0)::text || ' disponibles'
    end as stock_label
  from public.products p
  join public.product_admin_details d on d.product_id = p.id
  where p.slug = p_slug
    and p.internal_status = 'active'
    and d.publish_to_resellers = true
    and (
      coalesce(d.track_inventory, true) = false
      or greatest(coalesce(p.available_stock_quantity, coalesce(p.stock_quantity, 0) - coalesce(p.reserved_stock_quantity, 0)), 0) > 0
    )
  limit 1;
$$;

alter function public.get_retail_catalog() owner to postgres;
alter function public.get_retail_product(text) owner to postgres;
alter function public.validate_retail_cart(jsonb) owner to postgres;
alter function public.get_reseller_catalog() owner to postgres;
alter function public.get_reseller_product(text) owner to postgres;

revoke all on function public.get_retail_catalog() from public;
revoke all on function public.get_retail_product(text) from public;
revoke all on function public.validate_retail_cart(jsonb) from public;
revoke all on function public.get_reseller_catalog() from public;
revoke all on function public.get_reseller_product(text) from public;

grant execute on function public.get_retail_catalog() to anon, authenticated;
grant execute on function public.get_retail_product(text) to anon, authenticated;
grant execute on function public.validate_retail_cart(jsonb) to anon, authenticated;
grant execute on function public.get_reseller_catalog() to authenticated;
grant execute on function public.get_reseller_product(text) to authenticated;

commit;
