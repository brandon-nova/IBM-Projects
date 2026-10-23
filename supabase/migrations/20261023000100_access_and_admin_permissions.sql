-- IBM subdomains and administrator parity. Apply after the four 20261022 migrations.
begin;

create function public.ibm_email(p_email text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_email ~* '^[^[:space:]@]+@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])*ibm[.]com$'
    and pg_catalog.length(pg_catalog.split_part(p_email, '@', 2)) <= 253, false);
$$;
revoke all on function public.ibm_email(text) from public, anon, authenticated;

create or replace function public.provision_workspace_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare allowed public.approved_emails;
begin
  if public.ibm_email(new.email) then
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

create or replace function public.edit_project(p_project_id uuid, p_title text, p_description text, p_skills text[], p_estimated_hours numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.projects; tag text;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  perform public.assert_active();
  if p.id is null or not (public.workspace_admin() or p.owner_id is not distinct from auth.uid() or (p.owner_id is null and p.creator_id = auth.uid() and p.approval_status in ('draft','pending','rejected'))) then
    raise exception 'You cannot edit this project.' using errcode = '42501';
  end if;
  if p.work_status = 'completed' then raise exception 'Completed projects cannot be edited.'; end if;
  if coalesce(cardinality(p_skills),0) not between 1 and 20 then raise exception 'Choose between 1 and 20 skills.'; end if;
  update public.projects set title = btrim(p_title), description = btrim(p_description), estimated_hours = p_estimated_hours where id = p_project_id;
  delete from public.project_skills where project_id = p_project_id;
  foreach tag in array p_skills loop
    insert into public.project_skills values(p_project_id, public.ensure_skill(tag)) on conflict do nothing;
  end loop;
  return p_project_id;
end;
$$;

create or replace function public.request_publication(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  perform public.assert_active();
  if p.id is null or not (public.workspace_admin() or p.creator_id = auth.uid() or p.owner_id is not distinct from auth.uid()) then raise exception 'You cannot submit this proposal.' using errcode = '42501'; end if;
  if p.approval_status not in ('draft','rejected') or p.work_status = 'completed' then raise exception 'This project cannot be submitted for approval.'; end if;
  update public.projects set approval_status = 'pending', visibility = 'private' where id = p_project_id;
  return p_project_id;
end;
$$;

create or replace function public.review_join(p_request_id uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.project_requests; p public.projects;
begin
  perform public.assert_active();
  select * into r from public.project_requests where id = p_request_id;
  select * into p from public.projects where id = r.project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can review requests.' using errcode = '42501'; end if;
  select * into r from public.project_requests where id = p_request_id for update;
  perform public.assert_active();
  if r.status <> 'pending' or r.request_type <> 'join' or p.work_status = 'completed' then raise exception 'This request cannot be reviewed.'; end if;
  if not exists (select 1 from public.approved_emails where user_id = r.user_id and active) then raise exception 'This user no longer has workspace access.'; end if;
  if p_accept then
    insert into public.project_members(project_id,user_id) values(r.project_id,r.user_id)
      on conflict(project_id,user_id) do update set membership_status = 'active';
  end if;
  update public.project_requests set status = case when p_accept then 'accepted' else 'rejected' end, reviewed_by = auth.uid() where id = p_request_id;
  return r.project_id;
end;
$$;

create or replace function public.review_deliverable(p_deliverable_id uuid, p_accept boolean, p_feedback text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.project_deliverables; p public.projects;
begin
  perform public.assert_active();
  select * into d from public.project_deliverables where id = p_deliverable_id;
  select * into p from public.projects where id = d.project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can review work.' using errcode = '42501'; end if;
  select * into d from public.project_deliverables where id = p_deliverable_id for update;
  perform public.assert_active();
  if p.work_status = 'completed' or d.status = 'accepted' then raise exception 'This contribution can no longer be reviewed.'; end if;
  if p_accept is null then raise exception 'Choose a review decision.'; end if;
  if not p_accept and char_length(btrim(coalesce(p_feedback,''))) = 0 then raise exception 'Explain what needs to change.'; end if;
  update public.project_deliverables set status = case when p_accept then 'accepted'::public.deliverable_status else 'changes_requested'::public.deliverable_status end,
    reviewed_by = auth.uid(), reviewed_at = now(), feedback = btrim(coalesce(p_feedback,'')) where id = p_deliverable_id;
  return d.project_id;
end;
$$;

create or replace function public.complete_project(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can complete this project.' using errcode = '42501'; end if;
  if p.work_status = 'completed' then raise exception 'This project is already completed.'; end if;
  if not exists(select 1 from public.project_deliverables where project_id = p_project_id and status = 'accepted') then raise exception 'Accept at least one contribution before completing the project.'; end if;
  update public.projects set work_status = 'completed', completed_at = now(), completed_by = auth.uid() where id = p_project_id;
  return p_project_id;
end;
$$;

create or replace function public.start_project(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_active();
  perform 1 from public.projects where id = p_project_id and (owner_id = auth.uid() or public.workspace_admin()) and work_status = 'open' for update;
  if not found then raise exception 'Only the owner or an admin can start an open project.' using errcode = '42501'; end if;
  update public.projects set work_status = 'in_progress' where id = p_project_id;
  return p_project_id;
end;
$$;

commit;
