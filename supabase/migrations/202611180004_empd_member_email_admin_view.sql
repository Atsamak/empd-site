alter table public.profiles add column if not exists email text not null default '';

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and coalesce(p.email,'') <> coalesce(u.email,'');

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles(id, full_name, email)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''))
  on conflict(id) do update
    set email = excluded.email;
  insert into public.user_roles(user_id, role)
  values(new.id, 'member')
  on conflict(user_id) do nothing;
  return new;
end;
$fn$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.profiles
  set email = coalesce(new.email,''), updated_at = now()
  where id = new.id;
  return new;
end;
$fn$;
revoke all on function private.handle_user_email_update() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.handle_user_email_update();

revoke update on public.profiles from authenticated;
grant update(full_name, updated_at) on public.profiles to authenticated;