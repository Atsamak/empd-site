-- EMPD: atomically change member roles and preserve at least one administrator.
-- SECURITY INVOKER: the Edge Function calls this RPC with the service_role key.
create or replace function public.set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_role text;
  admin_count bigint;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('admin', 'member') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('empd-user-role-change')::bigint
  );

  select role into current_role
  from public.user_roles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if current_role = 'admin' and p_role = 'member' then
    select count(*) into admin_count
    from public.user_roles
    where role = 'admin';

    if admin_count <= 1 then
      raise exception 'Cannot demote the last administrator' using errcode = '23514';
    end if;
  end if;

  update public.user_roles
  set role = p_role
  where user_id = p_user_id;
end;
$$;

revoke all on function public.set_member_role(uuid, text) from public, anon, authenticated;
grant execute on function public.set_member_role(uuid, text) to service_role;
