-- Single workspace. All application writes go through actor-checked RPCs.
create type public.workspace_role as enum ('member', 'admin');
create type public.skill_type as enum ('existing', 'learning');
create type public.project_visibility as enum ('private', 'organization');
create type public.approval_status as enum ('draft', 'pending', 'approved', 'rejected');
create type public.work_status as enum ('open', 'in_progress', 'completed');
create type public.deliverable_status as enum ('submitted', 'changes_requested', 'accepted');

create table public.approved_emails (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  user_id uuid unique references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  role public.workspace_role not null default 'member',
  updated_at timestamptz not null default now()
);
create table public.user_availability (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  available_hours numeric check (available_hours between 0 and 168),
  updated_at timestamptz not null default now()
);
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create unique index skills_name_key on public.skills (lower(name));
create table public.user_skills (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  type public.skill_type not null,
  primary key (user_id, skill_id, type)
);
create index user_skills_skill_idx on public.user_skills(skill_id, type);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(user_id),
  owner_id uuid references public.profiles(user_id),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  estimated_hours numeric check (estimated_hours > 0 and estimated_hours <= 10000),
  visibility public.project_visibility not null default 'private',
  approval_status public.approval_status not null default 'draft',
  work_status public.work_status not null default 'open',
  completed_by uuid references public.profiles(user_id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility <> 'organization' or (approval_status = 'approved' and owner_id is not null)),
  check (approval_status <> 'approved' or owner_id is not null),
  check ((work_status = 'completed') = (completed_at is not null and completed_by is not null))
);
create index projects_discovery_idx on public.projects(visibility, approval_status, work_status);
create index projects_creator_idx on public.projects(creator_id);
create index projects_owner_idx on public.projects(owner_id);
create table public.project_skills (
  project_id uuid not null references public.projects(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  primary key(project_id, skill_id)
);
create index project_skills_skill_idx on public.project_skills(skill_id);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id),
  membership_status text not null default 'active' check (membership_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  primary key(project_id, user_id)
);
create index project_members_user_idx on public.project_members(user_id, membership_status);
create table public.project_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id),
  request_type text not null default 'join' check (request_type in ('join', 'invitation')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, user_id, request_type)
);
create index project_requests_user_idx on public.project_requests(user_id, status);
create index project_requests_pending_idx on public.project_requests(project_id, status);
create table public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contributor_id uuid not null references public.profiles(user_id),
  url text not null check (char_length(url) <= 2048 and url ~* '^https?://[^[:space:]/@]+([/?#][^[:space:]]*)?$'),
  summary text not null check (char_length(btrim(summary)) between 10 and 2000),
  outcome text not null default '' check (char_length(outcome) <= 1000),
  status public.deliverable_status not null default 'submitted',
  reviewed_by uuid references public.profiles(user_id),
  reviewed_at timestamptz,
  feedback text not null default '' check (char_length(feedback) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, contributor_id),
  foreign key(project_id, contributor_id) references public.project_members(project_id, user_id),
  check ((status = 'submitted' and reviewed_by is null and reviewed_at is null)
    or (status <> 'submitted' and reviewed_by is not null and reviewed_at is not null))
);
create index project_deliverables_contributor_idx on public.project_deliverables(contributor_id, status);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
do $$ declare t text; begin
  foreach t in array array['approved_emails','profiles','user_roles','user_availability','projects','project_requests','project_deliverables'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Signup is guarded at auth.users insertion, not just in the Next.js form.
create function public.provision_workspace_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare allowed public.approved_emails;
begin
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
create trigger provision_workspace_user after insert on auth.users
for each row execute function public.provision_workspace_user();

-- Email changes are deliberately not offered in V1; otherwise an approved account
-- could be transferred to an unapproved address through the Auth API.
create function public.keep_workspace_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) is distinct from lower(old.email) then
    raise exception 'Email changes are not supported in this workspace.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger keep_workspace_email before update of email on auth.users
for each row execute function public.keep_workspace_email();

create function public.workspace_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.approved_emails a join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid() and a.active and u.email_confirmed_at is not null
  );
$$;
create function public.workspace_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.workspace_active() and exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  );
$$;
create function public.project_member(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.workspace_active() and exists (
    select 1 from public.project_members where project_id = p_project_id
      and user_id = auth.uid() and membership_status = 'active'
  );
$$;
create function public.project_visible(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.workspace_active() and exists (
    select 1 from public.projects p where p.id = p_project_id and (
      (p.visibility = 'organization' and p.approval_status = 'approved')
      or p.creator_id = auth.uid() or p.owner_id = auth.uid()
      or public.workspace_admin() or public.project_member(p.id)
    )
  );
$$;
create function public.assert_active() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.workspace_active() then raise exception 'Workspace access is required.' using errcode = '42501'; end if;
end;
$$;

-- Internal tag helper; not executable by application roles.
create function public.ensure_skill(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  insert into public.skills(name) values (btrim(p_name))
    on conflict (lower(name)) do update set name = public.skills.name returning id into result;
  return result;
end;
$$;
create function public.save_profile(p_display_name text, p_bio text, p_existing_skills text[], p_learning_skills text[], p_available_hours numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare tag text;
begin
  perform public.assert_active();
  if cardinality(p_existing_skills) > 20 or cardinality(p_learning_skills) > 20 then raise exception 'Choose up to 20 skills in each list.'; end if;
  perform 1 from public.profiles where user_id = auth.uid() for update;
  update public.profiles set display_name = btrim(p_display_name), bio = btrim(p_bio) where user_id = auth.uid();
  update public.user_availability set available_hours = p_available_hours where user_id = auth.uid();
  delete from public.user_skills where user_id = auth.uid();
  foreach tag in array coalesce(p_existing_skills, array[]::text[]) loop
    insert into public.user_skills values(auth.uid(), public.ensure_skill(tag), 'existing') on conflict do nothing;
  end loop;
  foreach tag in array coalesce(p_learning_skills, array[]::text[]) loop
    insert into public.user_skills values(auth.uid(), public.ensure_skill(tag), 'learning') on conflict do nothing;
  end loop;
  return auth.uid();
end;
$$;
create function public.save_interest(p_interest text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform public.assert_active();
  perform 1 from public.profiles where user_id = auth.uid() for update;
  if (select count(*) from public.user_skills where user_id = auth.uid() and type = 'learning') >= 20 then
    raise exception 'Your profile already has 20 learning interests. Edit your profile to make room.';
  end if;
  result = public.ensure_skill(p_interest);
  insert into public.user_skills values(auth.uid(), result, 'learning') on conflict do nothing;
  return result;
end;
$$;

create function public.create_project(p_title text, p_description text, p_skills text[], p_estimated_hours numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; tag text;
begin
  perform public.assert_active();
  if coalesce(cardinality(p_skills), 0) not between 1 and 20 then raise exception 'Choose between 1 and 20 skills.'; end if;
  insert into public.projects(creator_id, title, description, estimated_hours)
    values(auth.uid(), btrim(p_title), btrim(p_description), p_estimated_hours) returning id into result;
  insert into public.project_members(project_id, user_id) values(result, auth.uid());
  foreach tag in array p_skills loop
    insert into public.project_skills values(result, public.ensure_skill(tag)) on conflict do nothing;
  end loop;
  return result;
end;
$$;
create function public.edit_project(p_project_id uuid, p_title text, p_description text, p_skills text[], p_estimated_hours numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.projects; tag text;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  if not found or not (p.owner_id is not distinct from auth.uid() or (p.owner_id is null and p.creator_id = auth.uid() and p.approval_status in ('draft','pending','rejected'))) then
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
create function public.request_publication(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  if not found or not (p.creator_id = auth.uid() or p.owner_id is not distinct from auth.uid()) then raise exception 'You cannot submit this proposal.' using errcode = '42501'; end if;
  if p.approval_status not in ('draft','rejected') or p.work_status = 'completed' then raise exception 'This project cannot be submitted for approval.'; end if;
  update public.projects set approval_status = 'pending', visibility = 'private' where id = p_project_id;
  return p_project_id;
end;
$$;
create function public.assign_owner(p_project_id uuid, p_owner_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  perform 1 from public.projects where id = p_project_id and work_status <> 'completed' for update;
  if not found then raise exception 'This project is unavailable or already completed.'; end if;
  if not exists (select 1 from public.approved_emails a join auth.users u on u.id = a.user_id where a.user_id = p_owner_id and a.active and u.email_confirmed_at is not null) then
    raise exception 'Choose an active workspace user as owner.';
  end if;
  update public.projects set owner_id = p_owner_id where id = p_project_id;
  insert into public.project_members(project_id, user_id) values(p_project_id, p_owner_id)
    on conflict(project_id, user_id) do update set membership_status = 'active';
  return p_project_id;
end;
$$;
create function public.review_publication(p_project_id uuid, p_approve boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects;
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  select * into p from public.projects where id = p_project_id for update;
  if not found or p.approval_status <> 'pending' or p.work_status = 'completed' then raise exception 'No pending publication request.'; end if;
  if p_approve and (p.owner_id is null or not exists (select 1 from public.approved_emails where user_id = p.owner_id and active)) then
    raise exception 'Assign an active official owner before approving publication.';
  end if;
  update public.projects set approval_status = case when p_approve then 'approved'::public.approval_status else 'rejected'::public.approval_status end,
    visibility = case when p_approve then 'organization'::public.project_visibility else 'private'::public.project_visibility end where id = p_project_id;
  return p_project_id;
end;
$$;
create function public.request_join(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects; result uuid;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  if not found or p.visibility <> 'organization' or p.approval_status <> 'approved' or p.work_status = 'completed' then raise exception 'This project is not accepting requests.'; end if;
  if public.project_member(p_project_id) then raise exception 'You already participate in this project.'; end if;
  insert into public.project_requests(project_id, user_id) values(p_project_id, auth.uid())
    on conflict(project_id,user_id,request_type) do update set status = 'pending', reviewed_by = null
    returning id into result;
  return result;
end;
$$;
create function public.review_join(p_request_id uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.project_requests; p public.projects;
begin
  perform public.assert_active();
  select * into r from public.project_requests where id = p_request_id;
  select * into p from public.projects where id = r.project_id for update;
  if not found or p.owner_id is distinct from auth.uid() then raise exception 'Only the project owner can review requests.' using errcode = '42501'; end if;
  select * into r from public.project_requests where id = p_request_id for update;
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
create function public.submit_deliverable(p_project_id uuid, p_url text, p_summary text, p_outcome text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects; result uuid;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  if not found or not public.project_member(p_project_id) then raise exception 'Only participants can submit work.' using errcode = '42501'; end if;
  if p.work_status = 'completed' then raise exception 'This project is completed.'; end if;
  if exists(select 1 from public.project_deliverables where project_id = p_project_id and contributor_id = auth.uid() and status = 'accepted') then
    raise exception 'Accepted contributions cannot be changed.';
  end if;
  insert into public.project_deliverables(project_id,contributor_id,url,summary,outcome)
    values(p_project_id,auth.uid(),btrim(p_url),btrim(p_summary),btrim(coalesce(p_outcome,'')))
    on conflict(project_id,contributor_id) do update set url = excluded.url, summary = excluded.summary,
      outcome = excluded.outcome, status = 'submitted', reviewed_by = null, reviewed_at = null, feedback = ''
    returning id into result;
  return result;
end;
$$;
create function public.review_deliverable(p_deliverable_id uuid, p_accept boolean, p_feedback text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare d public.project_deliverables; p public.projects;
begin
  perform public.assert_active();
  select * into d from public.project_deliverables where id = p_deliverable_id;
  select * into p from public.projects where id = d.project_id for update;
  if not found or p.owner_id is distinct from auth.uid() then raise exception 'Only the official owner can review work.' using errcode = '42501'; end if;
  select * into d from public.project_deliverables where id = p_deliverable_id for update;
  if p.work_status = 'completed' or d.status = 'accepted' then raise exception 'This contribution can no longer be reviewed.'; end if;
  if not p_accept and char_length(btrim(coalesce(p_feedback,''))) = 0 then raise exception 'Explain what needs to change.'; end if;
  update public.project_deliverables set status = case when p_accept then 'accepted'::public.deliverable_status else 'changes_requested'::public.deliverable_status end,
    reviewed_by = auth.uid(), reviewed_at = now(), feedback = btrim(coalesce(p_feedback,'')) where id = p_deliverable_id;
  return d.project_id;
end;
$$;
create function public.complete_project(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  if not found or p.owner_id is distinct from auth.uid() then raise exception 'Only the official owner can complete this project.' using errcode = '42501'; end if;
  if p.work_status = 'completed' then raise exception 'This project is already completed.'; end if;
  if not exists(select 1 from public.project_deliverables where project_id = p_project_id and status = 'accepted') then raise exception 'Accept at least one contribution before completing the project.'; end if;
  update public.projects set work_status = 'completed', completed_at = now(), completed_by = auth.uid() where id = p_project_id;
  return p_project_id;
end;
$$;
create function public.start_project(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_active();
  perform 1 from public.projects where id = p_project_id and owner_id = auth.uid() and work_status = 'open' for update;
  if not found then raise exception 'Only the owner can start an open project.' using errcode = '42501'; end if;
  update public.projects set work_status = 'in_progress' where id = p_project_id;
  return p_project_id;
end;
$$;
create function public.manage_access(p_email text, p_active boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  lock table public.user_roles in share row exclusive mode;
  select user_id into target from public.approved_emails where email = lower(btrim(p_email));
  if not p_active and exists(select 1 from public.user_roles where user_id = target and role = 'admin')
    and (select count(*) from public.user_roles r join public.approved_emails a on a.user_id = r.user_id where r.role = 'admin' and a.active) <= 1 then
    raise exception 'Keep at least one active administrator.';
  end if;
  insert into public.approved_emails(email,active) values(lower(btrim(p_email)),p_active)
    on conflict(email) do update set active = excluded.active;
  return target;
end;
$$;
create function public.set_user_role(p_user_id uuid, p_role public.workspace_role) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  lock table public.user_roles in share row exclusive mode;
  if not exists(select 1 from public.approved_emails where user_id = p_user_id and active) then raise exception 'Choose an active workspace user.'; end if;
  if p_role = 'member' and exists(select 1 from public.user_roles where user_id = p_user_id and role = 'admin')
    and (select count(*) from public.user_roles r join public.approved_emails a on a.user_id = r.user_id where r.role = 'admin' and a.active) <= 1 then
    raise exception 'Keep at least one active administrator.';
  end if;
  update public.user_roles set role = p_role where user_id = p_user_id;
  return p_user_id;
end;
$$;

-- No direct application DML. RLS still isolates every readable relationship.
do $$ declare t text; begin
  foreach t in array array['approved_emails','profiles','user_roles','user_availability','skills','user_skills','projects','project_skills','project_members','project_requests','project_deliverables'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
create policy approved_email_admin on public.approved_emails for select to authenticated using(public.workspace_admin());
create policy profile_directory on public.profiles for select to authenticated using(public.workspace_active());
create policy role_read on public.user_roles for select to authenticated using(public.workspace_active() and (user_id = auth.uid() or public.workspace_admin()));
create policy availability_directory on public.user_availability for select to authenticated using(public.workspace_active());
create policy skill_catalogue on public.skills for select to authenticated using(public.workspace_active());
create policy user_skill_directory on public.user_skills for select to authenticated using(public.workspace_active());
create policy project_read on public.projects for select to authenticated using(public.project_visible(id));
create policy project_skill_read on public.project_skills for select to authenticated using(public.project_visible(project_id));
create policy project_member_read on public.project_members for select to authenticated using(public.project_visible(project_id));
create policy request_read on public.project_requests for select to authenticated using(public.workspace_active() and (
  user_id = auth.uid() or public.workspace_admin() or exists(select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
));
create policy deliverable_read on public.project_deliverables for select to authenticated using(public.project_visible(project_id)
  and (status = 'accepted' or public.project_member(project_id) or public.workspace_admin()));

-- Explicit per-function grants, including helpers; internal helpers remain private.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'touch_updated_at','provision_workspace_user','keep_workspace_email','workspace_active','workspace_admin',
      'project_member','project_visible','assert_active','ensure_skill','save_profile','save_interest','create_project',
      'edit_project','request_publication','assign_owner','review_publication','request_join','review_join',
      'submit_deliverable','review_deliverable','complete_project','start_project','manage_access','set_user_role'
    ]) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    if f.proname not in ('touch_updated_at','provision_workspace_user','keep_workspace_email','assert_active','ensure_skill') then
      execute format('grant execute on function %s to authenticated', f.signature);
    end if;
  end loop;
end $$;
revoke create on schema public from public;
grant usage on schema public to authenticated, service_role;
