-- Automatically approve exactly @ibm.com at the Auth account-creation boundary.
-- Apply after 20261022000100_core.sql. Existing revocations remain authoritative.
begin;

create or replace function public.provision_workspace_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare allowed public.approved_emails;
begin
  if lower(new.email) ~ '^[^[:space:]@]+@ibm[.]com$' then
    insert into public.approved_emails(email, active) values (lower(new.email), true)
      on conflict (email) do nothing;
  end if;

  select * into allowed from public.approved_emails where email = lower(new.email) for update;
  if not found or not allowed.active or allowed.user_id is not null then
    raise exception 'This email has not been approved for workspace access.' using errcode = '42501';
  end if;
  update public.approved_emails set user_id = new.id where email = allowed.email;
  insert into public.profiles(user_id, display_name) values
    (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)), 80));
  insert into public.user_roles(user_id) values (new.id);
  insert into public.user_availability(user_id) values (new.id);
  return new;
end;
$$;

-- Trigger-only; never callable by anonymous or signed-in API clients.
revoke all on function public.provision_workspace_user() from public, anon, authenticated;

commit;
