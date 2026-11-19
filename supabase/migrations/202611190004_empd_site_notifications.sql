-- Persistent notifications for every newly published EMPD item.
create table if not exists public.site_notifications (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  content_type text not null check (content_type in ('publication','gallery','video','resource')),
  title text not null,
  category text not null default '',
  target_url text not null,
  preview_url text,
  preview_mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists site_notifications_created_at_idx
  on public.site_notifications (created_at desc);

alter table public.site_notifications enable row level security;

drop policy if exists "Public can read site notifications" on public.site_notifications;
create policy "Public can read site notifications"
  on public.site_notifications for select
  to anon, authenticated using (true);

grant select on public.site_notifications to anon, authenticated;

create or replace function public.publish_site_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_title text;
  v_category text;
  v_target text;
  v_preview text;
  v_mime text;
begin
  if tg_op = 'DELETE' then
    v_type := case tg_table_name
      when 'publications' then 'publication'
      when 'gallery_items' then 'gallery'
      when 'media_videos' then 'video'
      when 'resources' then 'resource'
    end;
    delete from public.site_notifications
      where content_type = v_type and content_id = old.id;
    return old;
  end if;

  if new.status <> 'published' then
    if tg_op = 'UPDATE' and old.status = 'published' then
      v_type := case tg_table_name
        when 'publications' then 'publication'
        when 'gallery_items' then 'gallery'
        when 'media_videos' then 'video'
        when 'resources' then 'resource'
      end;
      delete from public.site_notifications
        where content_type = v_type and content_id = new.id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  case tg_table_name
    when 'publications' then
      v_type := 'publication';
      v_title := new.title;
      v_category := new.category;
      v_target := '/publications.html';
      v_preview := coalesce(new.image_url, new.attachment_url);
      v_mime := coalesce(new.attachment_mime_type, case when new.image_url is not null then 'image/*' else null end);
    when 'gallery_items' then
      v_type := 'gallery';
      v_title := new.title;
      v_category := new.category;
      v_target := '/galerie.html';
      v_preview := new.image_url;
      v_mime := new.media_mime_type;
    when 'media_videos' then
      v_type := 'video';
      v_title := new.title;
      v_category := new.category;
      v_target := '/empd-tv.html';
      v_preview := new.video_url;
      v_mime := new.video_mime_type;
    when 'resources' then
      v_type := 'resource';
      v_title := new.title;
      v_category := new.category;
      v_target := '/ressources.html';
      v_preview := new.file_url;
      v_mime := new.file_mime_type;
    else
      return new;
  end case;

  insert into public.site_notifications
    (content_id, content_type, title, category, target_url, preview_url, preview_mime_type)
  values
    (new.id, v_type, coalesce(nullif(v_title,''),'Nouveau contenu EMPD'),
     coalesce(v_category,''), v_target, v_preview, v_mime);

  return new;
end;
$$;

drop trigger if exists publications_site_notification on public.publications;
create trigger publications_site_notification
  after insert or update of status or delete on public.publications
  for each row execute function public.publish_site_notification();

drop trigger if exists gallery_site_notification on public.gallery_items;
create trigger gallery_site_notification
  after insert or update of status or delete on public.gallery_items
  for each row execute function public.publish_site_notification();

drop trigger if exists videos_site_notification on public.media_videos;
create trigger videos_site_notification
  after insert or update of status or delete on public.media_videos
  for each row execute function public.publish_site_notification();

drop trigger if exists resources_site_notification on public.resources;
create trigger resources_site_notification
  after insert or update of status or delete on public.resources
  for each row execute function public.publish_site_notification();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.site_notifications;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
