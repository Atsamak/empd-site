-- EMPD: support multimedia publications and downloadable documents.
alter table public.publications
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size bigint;
alter table public.resources
  add column if not exists file_name text,
  add column if not exists file_mime_type text,
  add column if not exists file_size bigint;
alter table public.gallery_items
  add column if not exists media_type text not null default 'image',
  add column if not exists media_name text,
  add column if not exists media_mime_type text,
  add column if not exists media_size bigint;
alter table public.media_videos
  add column if not exists video_mime_type text,
  add column if not exists video_file_name text,
  add column if not exists video_size bigint;
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif','application/pdf',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.presentation',
      'application/vnd.oasis.opendocument.spreadsheet','text/plain','text/csv','application/zip',
      'audio/mpeg','audio/mp4','audio/wav','audio/ogg','video/mp4','video/webm','video/quicktime'
    ]::text[]
where id = 'empd-media';
