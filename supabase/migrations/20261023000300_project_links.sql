begin;
create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  url text not null check (public.valid_deliverable_url(url)),
  created_by uuid not null references public.profiles(user_id),
  updated_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(project_id,url)
);
create trigger project_links_updated before update on public.project_links for each row execute function public.touch_updated_at();
alter table public.project_links enable row level security;
revoke all on public.project_links from anon,authenticated;
grant select on public.project_links to authenticated;
grant all on public.project_links to service_role;
create policy project_links_read on public.project_links for select to authenticated using(public.project_visible(project_id));
create function public.save_project_link(p_project_id uuid,p_label text,p_url text,p_link_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects; result uuid;
begin
  perform public.assert_active();
  select * into p from public.projects where id=p_project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can edit links.' using errcode='42501'; end if;
  if p.work_status='completed' then raise exception 'Completed project links cannot be edited.'; end if;
  if p_link_id is null then
    if (select count(*) from public.project_links where project_id=p_project_id)>=10 then raise exception 'Use up to 10 project links.'; end if;
    insert into public.project_links(project_id,label,url,created_by,updated_by) values(p_project_id,btrim(p_label),btrim(p_url),auth.uid(),auth.uid()) returning id into result;
  else
    update public.project_links set label=btrim(p_label),url=btrim(p_url),updated_by=auth.uid() where id=p_link_id and project_id=p_project_id returning id into result;
    if result is null then raise exception 'Link not found.'; end if;
  end if;
  return result;
end;
$$;
create function public.delete_project_link(p_link_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; p public.projects;
begin
  perform public.assert_active();
  select project_id into pid from public.project_links where id=p_link_id;
  select * into p from public.projects where id=pid for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can edit links.' using errcode='42501'; end if;
  if p.work_status='completed' then raise exception 'Completed project links cannot be edited.'; end if;
  delete from public.project_links where id=p_link_id;
  return pid;
end;
$$;
revoke all on function public.save_project_link(uuid,text,text,uuid),public.delete_project_link(uuid) from public,anon,authenticated;
grant execute on function public.save_project_link(uuid,text,text,uuid),public.delete_project_link(uuid) to authenticated;
commit;
