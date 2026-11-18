-- EMPD CMS: Auth, roles, content tables and public media bucket
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.user_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('member','admin')),
 created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $fn$ select exists(select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin'); $fn$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;
 insert into public.user_roles(user_id,role) values(new.id,'member') on conflict(user_id) do nothing;
 return new;
end; $fn$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create table if not exists public.publications (
 id uuid primary key default gen_random_uuid(), title text not null, category text not null default 'Actualité',
 body text not null default '', image_url text, status text not null default 'draft' check(status in ('draft','published')),
 published_at timestamptz, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.gallery_items (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 image_url text not null, alt_text text not null default '', category text not null default 'Activités',
 event_date date, status text not null default 'published' check(status in ('draft','published')),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.resources (
 id uuid primary key default gen_random_uuid(), title text not null, category text not null default 'Document',
 description text not null default '', file_url text, external_url text,
 status text not null default 'published' check(status in ('draft','published')),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.media_videos (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 video_url text not null, thumbnail_url text, category text not null default 'EMPD TV',
 status text not null default 'published' check(status in ('draft','published')),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.site_settings (
 setting_key text primary key, setting_value jsonb not null default '{}'::jsonb,
 updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.publications enable row level security;
alter table public.gallery_items enable row level security;
alter table public.resources enable row level security;
alter table public.media_videos enable row level security;
alter table public.site_settings enable row level security;

create policy "Profiles owner or admin read" on public.profiles for select to authenticated
 using(id=(select auth.uid()) or (select private.is_admin()));
create policy "Profiles owner or admin update" on public.profiles for update to authenticated
 using(id=(select auth.uid()) or (select private.is_admin()))
 with check(id=(select auth.uid()) or (select private.is_admin()));
create policy "Users read own role and admins all" on public.user_roles for select to authenticated
 using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy "Admins manage roles" on public.user_roles for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));

create policy "Publications public published read" on public.publications for select to anon,authenticated
 using(status='published' or (select private.is_admin()));
create policy "Admins manage publications" on public.publications for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));
create policy "Gallery public published read" on public.gallery_items for select to anon,authenticated
 using(status='published' or (select private.is_admin()));
create policy "Admins manage gallery" on public.gallery_items for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));
create policy "Resources public published read" on public.resources for select to anon,authenticated
 using(status='published' or (select private.is_admin()));
create policy "Admins manage resources" on public.resources for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));
create policy "Videos public published read" on public.media_videos for select to anon,authenticated
 using(status='published' or (select private.is_admin()));
create policy "Admins manage videos" on public.media_videos for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));
create policy "Settings public read" on public.site_settings for select to anon,authenticated using(true);
create policy "Admins manage settings" on public.site_settings for all to authenticated
 using((select private.is_admin())) with check((select private.is_admin()));

grant select on public.publications,public.gallery_items,public.resources,public.media_videos,public.site_settings to anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.user_roles to authenticated;
grant insert,update,delete on public.publications,public.gallery_items,public.resources,public.media_videos,public.site_settings to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('empd-media','empd-media',true,15728640,array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict(id) do update set public=true,file_size_limit=15728640,allowed_mime_types=excluded.allowed_mime_types;
create policy "Public view EMPD media" on storage.objects for select to anon,authenticated using(bucket_id='empd-media');
create policy "Admins upload EMPD media" on storage.objects for insert to authenticated
 with check(bucket_id='empd-media' and (select private.is_admin()));
create policy "Admins update EMPD media" on storage.objects for update to authenticated
 using(bucket_id='empd-media' and (select private.is_admin()))
 with check(bucket_id='empd-media' and (select private.is_admin()));
create policy "Admins delete EMPD media" on storage.objects for delete to authenticated
 using(bucket_id='empd-media' and (select private.is_admin()));