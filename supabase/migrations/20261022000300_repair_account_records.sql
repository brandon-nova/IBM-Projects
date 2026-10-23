-- Repair application records for a pre-existing, confirmed Auth account.
-- Only local administrator provisioning tools may call this operation.
begin;

create or replace function public.provision_workspace_records(
  p_user_id uuid,
  p_display_name text,
  p_admin boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target auth.users;
  allowed public.approved_emails;
  target_email text;
  target_name text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Administrator provisioning credentials are required.' using errcode = '42501';
  end if;

  select * into target from auth.users where id = p_user_id for update;
  if not found or target.email is null then
    raise exception 'The Auth account does not exist.' using errcode = 'P0001';
  end if;
  if target.email_confirmed_at is null then
    raise exception 'Confirm this account email before provisioning workspace access.' using errcode = 'P0001';
  end if;
  target_email := pg_catalog.lower(pg_catalog.btrim(target.email));
  target_name := pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_display_name), ''),
    nullif(pg_catalog.btrim(target.raw_user_meta_data->>'display_name'), ''),
    pg_catalog.split_part(target_email, '@', 1)), 80);

  insert into public.approved_emails(email) values (target_email)
    on conflict (email) do nothing;
  select * into allowed from public.approved_emails where email = target_email for update;
  if not allowed.active then
    raise exception 'Access was revoked. An administrator must explicitly restore it before provisioning.' using errcode = '42501';
  end if;
  if allowed.user_id is not null and allowed.user_id <> target.id then
    raise exception 'The approved email is bound to a different account.' using errcode = '42501';
  end if;

  update public.approved_emails set user_id = target.id where email = target_email;
  insert into public.profiles(user_id, display_name) values (target.id, target_name)
    on conflict (user_id) do nothing;
  insert into public.user_roles(user_id, role)
    values (target.id, case when p_admin then 'admin' else 'member' end::public.workspace_role)
    on conflict (user_id) do update set role = case when p_admin then excluded.role else public.user_roles.role end;
  insert into public.user_availability(user_id) values (target.id)
    on conflict (user_id) do nothing;
  return target.id;
end;
$$;

revoke all on function public.provision_workspace_records(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.provision_workspace_records(uuid, text, boolean) to service_role;

commit;
