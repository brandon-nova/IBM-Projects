-- Consent-based assignments. All mutations lock the project before requests.
begin;
alter table public.project_requests drop constraint project_requests_status_check;
alter table public.project_requests add constraint project_requests_status_check check(status in ('pending','accepted','rejected','canceled'));
alter table public.project_requests
  add column invited_by uuid references public.profiles(user_id),
  add column suggestion_kind text not null default 'contribution' check(suggestion_kind in ('contribution','training')),
  add column reason text not null default '' check(char_length(reason)<=360),
  add column last_invited_at timestamptz,
  add column responded_at timestamptz,
  add column canceled_by uuid references public.profiles(user_id);
create table public.project_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(user_id),
  event text not null check(event in ('invited','reinvited','accepted','declined','canceled')),
  reason text not null default '', created_at timestamptz not null default now()
);
create index project_request_events_request on public.project_request_events(request_id,created_at);
alter table public.project_request_events enable row level security;
revoke all on public.project_request_events from public,anon,authenticated;
grant select on public.project_request_events to authenticated;
grant all on public.project_request_events to service_role;
create policy request_events_read on public.project_request_events for select to authenticated using(
  public.workspace_active() and exists(select 1 from public.project_requests r where r.id=request_id
    and (r.user_id=auth.uid() or public.workspace_admin() or exists(select 1 from public.projects p where p.id=r.project_id and p.owner_id=auth.uid())))
);

create function public.account_eligible(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.approved_emails a join auth.users u on u.id=a.user_id
    where a.user_id=p_user_id and a.active and u.email_confirmed_at is not null);
$$;
create function public.invitation_eligible(p_project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.projects p where p.id=p_project_id and p.approval_status='approved'
    and p.visibility='organization' and p.work_status<>'completed' and public.account_eligible(p.owner_id));
$$;

create function public.invite_project_members(p_project_id uuid,p_user_ids uuid[],p_kind text default 'contribution',p_reason text default '',p_reinvite boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.projects; uid uuid; r public.project_requests; again boolean;
begin
  perform public.assert_active();
  select * into p from public.projects where id=p_project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can invite people.' using errcode='42501'; end if;
  if not public.invitation_eligible(p_project_id) then raise exception 'Choose a published, unfinished project with an active owner.'; end if;
  if coalesce(cardinality(p_user_ids),0) not between 1 and 25 or array_position(p_user_ids,null) is not null then raise exception 'Choose 1 to 25 employees.'; end if;
  if p_kind is null or p_kind not in ('contribution','training') or p_reason is null or char_length(btrim(p_reason))>360 then raise exception 'Check the invitation kind and reason.'; end if;
  for uid in select distinct x from unnest(p_user_ids) x order by x loop
    if not public.account_eligible(uid) then raise exception 'A selected employee no longer has active, verified access.'; end if;
    if exists(select 1 from public.project_members where project_id=p_project_id and user_id=uid and membership_status='active') then raise exception 'A selected employee already participates.'; end if;
    select * into r from public.project_requests where project_id=p_project_id and user_id=uid and request_type='invitation' for update;
    if found and r.status='pending' then continue; end if;
    again := found;
    if again and p_reinvite is distinct from true then raise exception 'Confirm an explicit reinvitation for a previous recipient.'; end if;
    insert into public.project_requests(project_id,user_id,request_type,invited_by,suggestion_kind,reason,last_invited_at)
      values(p_project_id,uid,'invitation',auth.uid(),p_kind,btrim(p_reason),now())
      on conflict(project_id,user_id,request_type) do update set status='pending',invited_by=auth.uid(),suggestion_kind=p_kind,reason=btrim(p_reason),last_invited_at=now(),responded_at=null,canceled_by=null,reviewed_by=null
      returning * into r;
    insert into public.project_request_events(request_id,actor_id,event,reason) values(r.id,auth.uid(),case when again then 'reinvited' else 'invited' end,r.reason);
  end loop;
  return p_project_id;
end;
$$;
create function public.respond_project_invitation(p_request_id uuid,p_accept boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.project_requests; p public.projects;
begin
  perform public.assert_active();
  select * into r from public.project_requests where id=p_request_id;
  select * into p from public.projects where id=r.project_id for update;
  select * into r from public.project_requests where id=p_request_id for update;
  perform public.assert_active();
  if r.id is null or r.user_id is distinct from auth.uid() or r.request_type<>'invitation' then raise exception 'This invitation is not yours.' using errcode='42501'; end if;
  if p_accept is null then raise exception 'Choose Accept or Decline.'; end if;
  if (r.status='accepted' and p_accept) or (r.status='rejected' and not p_accept) then return r.project_id; end if;
  if r.status<>'pending' or not public.invitation_eligible(r.project_id) then raise exception 'This invitation is no longer available.'; end if;
  update public.project_requests set status=case when p_accept then 'accepted' else 'rejected' end,responded_at=now() where id=r.id;
  if p_accept then
    insert into public.project_members(project_id,user_id) values(r.project_id,auth.uid()) on conflict(project_id,user_id) do update set membership_status='active';
    update public.project_requests set status='canceled',canceled_by=auth.uid(),responded_at=now() where project_id=r.project_id and user_id=auth.uid() and request_type='join' and status='pending';
  end if;
  insert into public.project_request_events(request_id,actor_id,event) values(r.id,auth.uid(),case when p_accept then 'accepted' else 'declined' end);
  return r.project_id;
end;
$$;
create function public.cancel_project_invitation(p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.project_requests; p public.projects;
begin
  perform public.assert_active();
  select * into r from public.project_requests where id=p_request_id;
  select * into p from public.projects where id=r.project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can cancel invitations.' using errcode='42501'; end if;
  select * into r from public.project_requests where id=p_request_id for update;
  perform public.assert_active();
  if r.request_type<>'invitation' or r.status<>'pending' then raise exception 'No pending invitation.'; end if;
  update public.project_requests set status='canceled',canceled_by=auth.uid(),responded_at=now() where id=r.id;
  return r.project_id;
end;
$$;
create function public.remove_project_member(p_project_id uuid,p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id=p_project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then raise exception 'Only the owner or an admin can remove participants.' using errcode='42501'; end if;
  if p.work_status='completed' then raise exception 'Completed project membership is preserved.'; end if;
  if p.owner_id=p_user_id then raise exception 'Reassign the official owner before removing them.'; end if;
  update public.project_members set membership_status='inactive' where project_id=p_project_id and user_id=p_user_id;
  return p_project_id;
end;
$$;

-- Every cancellation, including reconciliation, has an attributed event.
create function public.record_request_cancellation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='canceled' and old.status is distinct from new.status then
    insert into public.project_request_events(request_id,actor_id,event,reason)
      values(new.id,auth.uid(),'canceled',case when new.request_type='join' then 'Invitation accepted or membership assigned' else 'Invitation canceled or membership resolved' end);
  end if;
  return new;
end;
$$;
create trigger request_cancellation after update on public.project_requests for each row execute function public.record_request_cancellation();
create function public.reconcile_project_invitations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='projects' then
    if new.work_status='completed' and old.work_status<>'completed' then
      update public.project_requests set status='canceled',canceled_by=auth.uid(),responded_at=now() where project_id=new.id and request_type='invitation' and status='pending';
    end if;
  elsif new.membership_status='active' then
    -- The successful path records acceptance before adding the member.
    update public.project_requests set status='canceled',canceled_by=auth.uid(),responded_at=now()
      where project_id=new.project_id and user_id=new.user_id and status='pending';
  end if;
  return new;
end;
$$;
create trigger completion_invitations after update of work_status on public.projects for each row execute function public.reconcile_project_invitations();
create trigger membership_requests after insert or update on public.project_members for each row execute function public.reconcile_project_invitations();

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
  if p_accept is null then raise exception 'Choose a decision.'; end if;
  update public.project_requests set status = case when p_accept then 'accepted' else 'rejected' end, reviewed_by = auth.uid(), responded_at=now() where id = p_request_id;
  if p_accept then
    insert into public.project_members(project_id,user_id) values(r.project_id,r.user_id)
      on conflict(project_id,user_id) do update set membership_status = 'active';
  end if;
  return r.project_id;
end;
$$;


create or replace function public.assign_owner(p_project_id uuid, p_owner_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  perform 1 from public.projects where id = p_project_id and work_status <> 'completed' for update;
  if not found then raise exception 'This project is unavailable or already completed.'; end if;
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  if not exists (select 1 from public.approved_emails a join auth.users u on u.id = a.user_id where a.user_id = p_owner_id and a.active and u.email_confirmed_at is not null) then
    raise exception 'Choose an active workspace user as owner.';
  end if;
  update public.projects set owner_id = p_owner_id where id = p_project_id;
  insert into public.project_members(project_id, user_id) values(p_project_id, p_owner_id)
    on conflict(project_id, user_id) do update set membership_status = 'active';
  return p_project_id;
end;
$$;
create or replace function public.review_publication(p_project_id uuid, p_approve boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects;
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode = '42501'; end if;
  select * into p from public.projects where id = p_project_id for update;
  perform public.assert_active();
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  if p.id is null or p.approval_status <> 'pending' or p.work_status = 'completed' then raise exception 'No pending publication request.'; end if;
  if p_approve is null then raise exception 'Choose a publication decision.'; end if;
  if p_approve and (p.owner_id is null or not public.account_eligible(p.owner_id)) then
    raise exception 'Assign an active official owner before approving publication.';
  end if;
  update public.projects set approval_status = case when p_approve then 'approved'::public.approval_status else 'rejected'::public.approval_status end,
    visibility = case when p_approve then 'organization'::public.project_visibility else 'private'::public.project_visibility end where id = p_project_id;
  return p_project_id;
end;
$$;
create or replace function public.request_join(p_project_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.projects; result uuid;
begin
  perform public.assert_active();
  select * into p from public.projects where id = p_project_id for update;
  perform public.assert_active();
  if p.id is null or p.visibility <> 'organization' or p.approval_status <> 'approved' or p.work_status = 'completed' then raise exception 'This project is not accepting requests.'; end if;
  if public.project_member(p_project_id) then raise exception 'You already participate in this project.'; end if;
  insert into public.project_requests(project_id, user_id) values(p_project_id, auth.uid())
    on conflict(project_id,user_id,request_type) do update set status = 'pending', reviewed_by = null
    returning id into result;
  return result;
end;
$$;

-- Scoped active candidates. RLS never needs to expose auth.users to browsers.
create function public.assignment_candidates(p_project_id uuid,p_query text default '',p_offset integer default 0,p_limit integer default 100)
returns table(user_id uuid,display_name text,existing_ids uuid[],learning_ids uuid[],available_hours numeric)
language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_active();
  if not exists(select 1 from public.projects p where p.id=p_project_id and (p.owner_id=auth.uid() or public.workspace_admin())) then raise exception 'Owner or administrator access is required.' using errcode='42501'; end if;
  return query select pr.user_id,pr.display_name,
    array(select us.skill_id from public.user_skills us where us.user_id=pr.user_id and us.type='existing'),
    array(select us.skill_id from public.user_skills us where us.user_id=pr.user_id and us.type='learning'),a.available_hours
    from public.profiles pr left join public.user_availability a on a.user_id=pr.user_id
    where public.account_eligible(pr.user_id) and not pr.hidden_from_people
      and (coalesce(p_query,'')='' or pr.display_name ilike '%'||left(p_query,80)||'%' or exists(select 1 from public.user_skills us join public.skills s on s.id=us.skill_id where us.user_id=pr.user_id and s.name ilike '%'||left(p_query,80)||'%'))
    order by pr.display_name,pr.user_id offset greatest(0,coalesce(p_offset,0)) limit least(100,greatest(1,coalesce(p_limit,100)));
end;
$$;
create function public.pending_project_suggestions() returns uuid[]
language plpgsql security definer set search_path='' as $$
begin
  perform public.assert_active();
  return array(select r.id from public.project_requests r where r.user_id=auth.uid() and r.request_type='invitation'
    and r.status='pending' and public.invitation_eligible(r.project_id) and not public.project_member(r.project_id));
end;
$$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature,p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array['account_eligible','invitation_eligible','invite_project_members','respond_project_invitation','cancel_project_invitation','remove_project_member','record_request_cancellation','reconcile_project_invitations','assignment_candidates','pending_project_suggestions']) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.proname=any(array['invite_project_members','respond_project_invitation','cancel_project_invitation','remove_project_member','assignment_candidates','pending_project_suggestions']) then execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $$;
commit;
