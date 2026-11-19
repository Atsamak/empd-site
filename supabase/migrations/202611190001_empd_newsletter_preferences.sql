-- EMPD: newsletter preferences, opt-in by default, and signup metadata sync.
alter table public.profiles
  add column if not exists newsletter_subscribed boolean not null default false;

-- A new signup is subscribed only when the person explicitly checked the box.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles(id, full_name, email, newsletter_subscribed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    lower(coalesce(new.raw_user_meta_data->>'newsletter_subscribed','false')) = 'true'
  )
  on conflict(id) do update
    set email = excluded.email;

  insert into public.user_roles(user_id, role)
  values(new.id, 'member')
  on conflict(user_id) do nothing;

  return new;
end;
$fn$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Members may change only their own subscription preference.
grant update(newsletter_subscribed) on public.profiles to authenticated;
