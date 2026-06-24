-- Camaraza Reventa - contenido administrable para videos y redes.
-- Ejecutar en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.help_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  video_url text not null,
  duration text,
  thumbnail_url text,
  sort_order integer default 0,
  is_visible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Compatibilidad: si alguna prueba anterior creó la columna "url",
-- copiamos sus valores a "video_url" sin romper instalaciones nuevas.
alter table public.help_videos
add column if not exists video_url text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'help_videos'
      and column_name = 'url'
  ) then
    execute 'update public.help_videos set video_url = coalesce(video_url, url) where video_url is null';
  end if;
end $$;

update public.help_videos
set video_url = ''
where video_url is null;

alter table public.help_videos
alter column video_url set not null;

create index if not exists help_videos_sort_idx on public.help_videos(sort_order);
create index if not exists help_videos_visible_idx on public.help_videos(is_visible);

create table if not exists public.social_links (
  network text primary key,
  url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.help_videos enable row level security;
alter table public.social_links enable row level security;

drop policy if exists "Public can read visible help videos" on public.help_videos;
create policy "Public can read visible help videos"
on public.help_videos
for select
using (is_visible = true);

drop policy if exists "Authenticated can read all help videos" on public.help_videos;
create policy "Authenticated can read all help videos"
on public.help_videos
for select
to authenticated
using (true);

drop policy if exists "Authenticated can insert help videos" on public.help_videos;
create policy "Authenticated can insert help videos"
on public.help_videos
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update help videos" on public.help_videos;
create policy "Authenticated can update help videos"
on public.help_videos
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete help videos" on public.help_videos;
create policy "Authenticated can delete help videos"
on public.help_videos
for delete
to authenticated
using (true);

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

-- Pide a PostgREST/Supabase refrescar schema cache.
notify pgrst, 'reload schema';
