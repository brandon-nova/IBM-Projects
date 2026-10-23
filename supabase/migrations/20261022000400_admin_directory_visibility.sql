-- An optional directory preference, not account deletion or anonymous participation.
begin;

alter table public.profiles
  add column hidden_from_people boolean not null default false;

create function public.set_directory_visibility(p_hidden boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize against role/access changes and recheck the authenticated actor.
  lock table public.user_roles in share row exclusive mode;
  if not public.workspace_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_hidden is null then
    raise exception 'Choose whether to show your profile in People.';
  end if;
  update public.profiles set hidden_from_people = p_hidden where user_id = auth.uid();
  return auth.uid();
end;
$$;
revoke all on function public.set_directory_visibility(boolean) from public, anon, authenticated;
grant execute on function public.set_directory_visibility(boolean) to authenticated;

-- A former administrator returns to the ordinary member directory.
create function public.restore_member_directory_visibility() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role <> 'admin' then
    update public.profiles set hidden_from_people = false where user_id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function public.restore_member_directory_visibility() from public, anon, authenticated;
create trigger restore_member_directory_visibility after update of role on public.user_roles
for each row execute function public.restore_member_directory_visibility();

commit;
