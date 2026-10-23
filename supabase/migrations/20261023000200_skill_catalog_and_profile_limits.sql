-- Catalog-only skills. Legacy RPCs remain safe for old tabs and seed tools.
begin;
-- Inventory without truncating or deleting historical data.
do $$ begin
  raise notice 'Legacy bios over 360: %', (select count(*) from public.profiles where char_length(bio)>360);
  raise notice 'Legacy learning lists over six: %', (select count(*) from (select user_id from public.user_skills where type='learning' group by user_id having count(*)>6) legacy);
end $$;
alter table public.skills add column active boolean not null default true;
create table public.skill_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(user_id),
  name text not null check (char_length(name) between 1 and 80),
  normalized_name text generated always as (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))) stored,
  reason text not null default '' check (char_length(reason) <= 360),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(user_id),
  reviewed_at timestamptz,
  feedback text not null default '' check (char_length(feedback) <= 360),
  approved_skill_id uuid references public.skills(id),
  created_at timestamptz not null default now(),
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)),
  check (status <> 'approved' or approved_skill_id is not null)
);
create unique index skill_requests_pending_name on public.skill_requests(normalized_name) where status = 'pending';
alter table public.skill_requests enable row level security;
revoke all on public.skill_requests from anon, authenticated;
grant select on public.skill_requests to authenticated;
grant all on public.skill_requests to service_role;
create policy skill_request_read on public.skill_requests for select to authenticated
  using (public.workspace_active() and (requester_id = auth.uid() or public.workspace_admin()));

-- Legacy bios remain readable. Only newly inserted/changed bios are restricted,
-- so visibility changes and role demotion never fail on an old long biography.
create function public.limit_profile_bio() returns trigger
language plpgsql set search_path = '' as $$
begin
  if char_length(new.bio) > 360 and (tg_op = 'INSERT' or new.bio is distinct from old.bio) then
    raise exception 'Use at most 360 characters for your bio.';
  end if;
  return new;
end;
$$;
create trigger limit_profile_bio before insert or update of bio on public.profiles
for each row execute function public.limit_profile_bio();

create or replace function public.ensure_skill(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  select id into result from public.skills where lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')) = lower(regexp_replace(btrim(p_name),'[[:space:]]+',' ','g')) and active order by created_at,id limit 1;
  if result is null then raise exception 'Select an approved skill from the catalog, or request it.'; end if;
  return result;
end;
$$;

create function public.catalog_ids(p_names text[]) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare result uuid[] := '{}'; item text; sid uuid;
begin
  if coalesce(cardinality(p_names),0) > 20 then raise exception 'Choose up to 20 skills.'; end if;
  foreach item in array coalesce(p_names, array[]::text[]) loop
    select id into sid from public.skills where lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')) = lower(regexp_replace(btrim(item),'[[:space:]]+',' ','g')) order by created_at,id limit 1;
    if sid is null then raise exception 'Select an approved skill from the catalog, or request it.'; end if;
    result := array_append(result, sid);
  end loop;
  return result;
end;
$$;

create function public.save_profile_skills(p_display_name text, p_bio text, p_existing_ids uuid[], p_learning_ids uuid[], p_available_hours numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing_ids uuid[]; learning_ids uuid[];
begin
  perform public.assert_active();
  perform 1 from public.profiles where user_id = auth.uid() for update;
  perform public.assert_active();
  if array_position(p_existing_ids,null) is not null or array_position(p_learning_ids,null) is not null then raise exception 'Choose catalog skills.'; end if;
  select coalesce(array_agg(distinct x), '{}') into existing_ids from unnest(p_existing_ids) x;
  select coalesce(array_agg(distinct x), '{}') into learning_ids from unnest(p_learning_ids) x;
  if cardinality(existing_ids) > 20 or cardinality(learning_ids) > 6 then raise exception 'Choose up to 20 existing skills and 6 learning interests.'; end if;
  if char_length(btrim(p_bio)) > 360 then raise exception 'Use at most 360 characters for your bio.'; end if;
  if exists(select 1 from (select x as sid,'existing'::public.skill_type as kind from unnest(existing_ids) x union all select x,'learning'::public.skill_type from unnest(learning_ids) x) chosen where not exists(
    select 1 from public.skills s where s.id = chosen.sid and (s.active or exists(select 1 from public.user_skills u where u.user_id = auth.uid() and u.skill_id = s.id and u.type=chosen.kind)))) then
    raise exception 'Choose approved skills from the catalog.';
  end if;
  update public.profiles set display_name = btrim(p_display_name), bio = btrim(p_bio) where user_id = auth.uid();
  update public.user_availability set available_hours = p_available_hours where user_id = auth.uid();
  delete from public.user_skills where user_id = auth.uid();
  insert into public.user_skills select auth.uid(),x,'existing'::public.skill_type from unnest(existing_ids) x;
  insert into public.user_skills select auth.uid(),x,'learning'::public.skill_type from unnest(learning_ids) x;
  return auth.uid();
end;
$$;
create or replace function public.save_profile(p_display_name text, p_bio text, p_existing_skills text[], p_learning_skills text[], p_available_hours numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_active();
  return public.save_profile_skills(p_display_name,p_bio,public.catalog_ids(p_existing_skills),public.catalog_ids(p_learning_skills),p_available_hours);
end;
$$;

create function public.save_learning_interest(p_skill_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_active();
  perform 1 from public.profiles where user_id = auth.uid() for update;
  perform public.assert_active();
  if exists(select 1 from public.user_skills where user_id = auth.uid() and skill_id = p_skill_id and type = 'learning') then return p_skill_id; end if;
  if (select count(*) from public.user_skills where user_id = auth.uid() and type = 'learning') >= 6 then raise exception 'Choose up to 6 learning interests. Edit your profile to make room.'; end if;
  if not exists(select 1 from public.skills where id = p_skill_id and active) then raise exception 'Choose an approved skill.'; end if;
  insert into public.user_skills values(auth.uid(),p_skill_id,'learning');
  return p_skill_id;
end;
$$;
create or replace function public.save_interest(p_interest text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_active();
  return public.save_learning_interest(public.ensure_skill(p_interest));
end;
$$;

create function public.create_project_with_skills(p_title text, p_description text, p_skill_ids uuid[], p_estimated_hours numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform public.assert_active();
  if coalesce(cardinality(p_skill_ids),0) not between 1 and 20 or array_position(p_skill_ids,null) is not null then raise exception 'Choose 1 to 20 catalog skills.'; end if;
  if exists(select 1 from unnest(p_skill_ids) x where not exists(select 1 from public.skills where id = x and active)) then raise exception 'Choose approved skills.'; end if;
  insert into public.projects(creator_id,title,description,estimated_hours) values(auth.uid(),btrim(p_title),btrim(p_description),p_estimated_hours) returning id into result;
  insert into public.project_members(project_id,user_id) values(result,auth.uid());
  insert into public.project_skills select distinct result,x from unnest(p_skill_ids) x;
  return result;
end;
$$;
create function public.edit_project_with_skills(p_project_id uuid, p_title text, p_description text, p_skill_ids uuid[], p_estimated_hours numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  perform public.assert_active();
  if p.id is null or not (public.workspace_admin() or p.owner_id is not distinct from auth.uid() or (p.owner_id is null and p.creator_id = auth.uid() and p.approval_status <> 'approved')) then raise exception 'You cannot edit this project.' using errcode = '42501'; end if;
  if p.work_status = 'completed' then raise exception 'Completed projects cannot be edited.'; end if;
  if coalesce(cardinality(p_skill_ids),0) not between 1 and 20 or array_position(p_skill_ids,null) is not null then raise exception 'Choose 1 to 20 catalog skills.'; end if;
  if exists(select 1 from unnest(p_skill_ids) x where not exists(select 1 from public.skills s where s.id = x and (s.active or exists(select 1 from public.project_skills ps where ps.project_id = p_project_id and ps.skill_id = x)))) then raise exception 'Choose approved skills.'; end if;
  update public.projects set title = btrim(p_title),description = btrim(p_description),estimated_hours = p_estimated_hours where id = p_project_id;
  delete from public.project_skills where project_id = p_project_id;
  insert into public.project_skills select distinct p_project_id,x from unnest(p_skill_ids) x;
  return p_project_id;
end;
$$;
create or replace function public.create_project(p_title text,p_description text,p_skills text[],p_estimated_hours numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_active();
  return public.create_project_with_skills(p_title,p_description,public.catalog_ids(p_skills),p_estimated_hours);
end;
$$;
create or replace function public.edit_project(p_project_id uuid,p_title text,p_description text,p_skills text[],p_estimated_hours numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_active();
  return public.edit_project_with_skills(p_project_id,p_title,p_description,public.catalog_ids(p_skills),p_estimated_hours);
end;
$$;

create function public.request_skill(p_name text,p_reason text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; clean text := regexp_replace(btrim(p_name),'[[:space:]]+',' ','g');
begin
  perform public.assert_active();
  if exists(select 1 from public.skills where lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')) = lower(clean) and active) then raise exception 'This skill is already in the catalog.'; end if;
  insert into public.skill_requests(requester_id,name,reason) values(auth.uid(),clean,btrim(p_reason)) on conflict do nothing returning id into result;
  if result is null then raise exception 'This skill has already been requested and is awaiting review.'; end if;
  return result;
end;
$$;
create function public.review_skill_request(p_request_id uuid,p_approve boolean,p_feedback text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.skill_requests; sid uuid;
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  select * into r from public.skill_requests where id = p_request_id for update;
  if not found or r.status <> 'pending' or p_approve is null then raise exception 'No pending skill request.'; end if;
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_approve then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.normalized_name,0));
    select id into sid from public.skills where lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))=r.normalized_name order by created_at,id limit 1;
    if sid is null then
      insert into public.skills(name) values(r.name) on conflict(lower(name)) do update set active = true returning id into sid;
    else update public.skills set active=true where id=sid;
    end if;
  elsif char_length(btrim(coalesce(p_feedback,''))) = 0 then raise exception 'Explain why the skill was declined.';
  end if;
  update public.skill_requests set status = case when p_approve then 'approved' else 'rejected' end,
    approved_skill_id = sid,reviewed_by = auth.uid(),reviewed_at = now(),feedback = btrim(coalesce(p_feedback,'')) where id = r.id;
  return r.id;
end;
$$;
create function public.set_skill_active(p_skill_id uuid,p_active boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  if p_active is null then raise exception 'Choose a catalog status.'; end if;
  update public.skills set active = p_active where id = p_skill_id;
  if not found then raise exception 'Skill not found.'; end if;
  return p_skill_id;
end;
$$;

-- Restrict every newly defined function. Internal helpers are never user-callable.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array['limit_profile_bio','ensure_skill','catalog_ids','save_profile_skills','save_learning_interest','create_project_with_skills','edit_project_with_skills','request_skill','review_skill_request','set_skill_active']) loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    if f.proname not in ('limit_profile_bio','ensure_skill','catalog_ids') then execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $$;
insert into public.skills (name) values
('Python'), ('SQL'), ('AI'), ('Design'), ('Web development'), ('React'),
('TypeScript'), ('Data engineering'), ('Documentation'), ('Automation'),
('JavaScript'),('Java'),('Go'),('C#'),('C++'),('Bash'),('R'),('HTML'),('CSS'),
('Node.js'),('Next.js'),('Angular'),('Vue.js'),('REST APIs'),('GraphQL'),
('PostgreSQL'),('Db2'),('MongoDB'),('Data analysis'),('Data visualization'),('Excel'),
('Power BI'),('Tableau'),('Machine learning'),('Generative AI'),('watsonx'),
('UX design'),('UI design'),('User research'),('Accessibility'),('Technical writing'),
('Testing'),('Quality assurance'),('Git'),('Docker'),('Kubernetes'),('OpenShift'),
('CI/CD'),('Terraform'),('IBM Cloud'),('AWS'),('Azure'),('Google Cloud'),('Linux'),
('Cybersecurity'),('Project coordination'),('Agile'),('Facilitation'),('Public speaking')
on conflict (lower(name)) do nothing;

commit;
