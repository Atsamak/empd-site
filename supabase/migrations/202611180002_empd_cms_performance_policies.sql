-- EMPD: optimize foreign-key lookups and avoid overlapping permissive SELECT policies.
create index if not exists idx_gallery_items_created_by on public.gallery_items(created_by);
create index if not exists idx_media_videos_created_by on public.media_videos(created_by);
create index if not exists idx_publications_created_by on public.publications(created_by);
create index if not exists idx_resources_created_by on public.resources(created_by);
create index if not exists idx_site_settings_updated_by on public.site_settings(updated_by);

drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Admins insert roles" on public.user_roles for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update roles" on public.user_roles for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete roles" on public.user_roles for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Admins manage publications" on public.publications;
create policy "Admins insert publications" on public.publications for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update publications" on public.publications for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete publications" on public.publications for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Admins manage gallery" on public.gallery_items;
create policy "Admins insert gallery" on public.gallery_items for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update gallery" on public.gallery_items for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete gallery" on public.gallery_items for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Admins manage resources" on public.resources;
create policy "Admins insert resources" on public.resources for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update resources" on public.resources for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete resources" on public.resources for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Admins manage videos" on public.media_videos;
create policy "Admins insert videos" on public.media_videos for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update videos" on public.media_videos for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete videos" on public.media_videos for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Admins manage settings" on public.site_settings;
create policy "Admins insert settings" on public.site_settings for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update settings" on public.site_settings for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete settings" on public.site_settings for delete to authenticated using ((select private.is_admin()));