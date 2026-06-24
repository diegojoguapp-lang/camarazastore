-- Camaraza Reventa - contenido administrable para videos y redes.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.help_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  duration text,
  thumbnail_url text,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists help_videos_sort_idx on public.help_videos(sort_order);

create table if not exists public.social_links (
  network text primary key,
  url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.help_videos enable row level security;
alter table public.social_links enable row level security;

drop policy if exists "Public can read visible help videos" on public.help_videos;
create policy "Public can read visible help videos"
on public.help_videos
for select
using (is_visible = true);

drop policy if exists "Authenticated can manage help videos" on public.help_videos;
create policy "Authenticated can manage help videos"
on public.help_videos
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read social links" on public.social_links;
create policy "Public can read social links"
on public.social_links
for select
using (true);

drop policy if exists "Authenticated can manage social links" on public.social_links;
create policy "Authenticated can manage social links"
on public.social_links
for all
to authenticated
using (true)
with check (true);

insert into public.social_links (network, url)
values
  ('instagram', ''),
  ('whatsapp', ''),
  ('tiktok', ''),
  ('facebook', '')
on conflict (network) do nothing;
