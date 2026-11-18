drop policy if exists "Settings public read" on public.site_settings;
create policy "Public read page settings only" on public.site_settings
  for select to anon, authenticated
  using (setting_key like 'page:%');
