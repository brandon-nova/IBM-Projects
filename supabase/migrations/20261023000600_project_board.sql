-- Native boards keep all tasks when the owner switches to an external tool.
begin;
alter table public.projects
  add column board_mode text not null default 'native' check(board_mode in ('native','external')),
  add column external_board_url text check(external_board_url is null or public.valid_deliverable_url(external_board_url)),
  add constraint projects_external_board_required check(board_mode<>'external' or external_board_url is not null);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check(char_length(btrim(title)) between 1 and 160),
  description text not null default '' check(char_length(description)<=2000),
  status text not null default 'todo' check(status in ('todo','in_progress','done')),
  position bigint not null default 0 check(position>=0),
  assignee_id uuid references public.profiles(user_id),
  created_by uuid not null references public.profiles(user_id),
  updated_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_tasks_board on public.project_tasks(project_id,status,position,id);
create trigger touch_updated_at before update on public.project_tasks for each row execute function public.touch_updated_at();
alter table public.project_tasks enable row level security;
revoke all on public.project_tasks from public,anon,authenticated;
grant select on public.project_tasks to authenticated;
grant all on public.project_tasks to service_role;
create policy project_tasks_read on public.project_tasks for select to authenticated
  using(public.workspace_active() and public.project_visible(project_id));

-- Internal helper. All task operations serialize against board mode changes,
-- completion and membership operations through the existing project-row lock.
create function public.lock_native_board(p_project_id uuid) returns public.projects
language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id=p_project_id for update;
  perform public.assert_active();
  if p.id is null or not (public.workspace_admin() or public.project_member(p_project_id)) then
    raise exception 'Only participants or admins can edit this board.' using errcode='42501';
  end if;
  if p.work_status='completed' then raise exception 'Completed project boards are read-only.'; end if;
  if p.board_mode<>'native' then raise exception 'Switch back to the native board before changing tasks.'; end if;
  return p;
end;
$$;

create function public.save_project_task(p_project_id uuid,p_title text,p_description text default '',p_assignee_id uuid default null,p_task_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.project_tasks; result uuid; next_position bigint;
begin
  perform public.lock_native_board(p_project_id);
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160
    or p_description is null or char_length(p_description)>2000 then raise exception 'Use a task title up to 160 characters and description up to 2000.'; end if;
  if p_task_id is not null then
    select * into t from public.project_tasks where id=p_task_id and project_id=p_project_id for update;
    if t.id is null then raise exception 'This task is no longer available.'; end if;
  end if;
  if p_assignee_id is not null and (p_task_id is null or p_assignee_id is distinct from t.assignee_id)
    and not exists(select 1 from public.project_members m where m.project_id=p_project_id
      and m.user_id=p_assignee_id and m.membership_status='active' and public.account_eligible(m.user_id)) then
    raise exception 'Assign tasks to an active project participant.';
  end if;
  if p_task_id is null then
    select coalesce(max(position),0)+1 into next_position from public.project_tasks where project_id=p_project_id and status='todo';
    insert into public.project_tasks(project_id,title,description,assignee_id,position,created_by,updated_by)
      values(p_project_id,btrim(p_title),btrim(p_description),p_assignee_id,next_position,auth.uid(),auth.uid()) returning id into result;
  else
    update public.project_tasks set title=btrim(p_title),description=btrim(p_description),assignee_id=p_assignee_id,updated_by=auth.uid()
      where id=t.id returning id into result;
  end if;
  return result;
end;
$$;

create function public.move_project_task(p_project_id uuid,p_task_id uuid,p_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.project_tasks; next_position bigint;
begin
  perform public.lock_native_board(p_project_id);
  if p_status is null or p_status not in ('todo','in_progress','done') then raise exception 'Choose To Do, In Progress, or Done.'; end if;
  select * into t from public.project_tasks where id=p_task_id and project_id=p_project_id for update;
  if t.id is null then raise exception 'This task is no longer available.'; end if;
  if t.status=p_status then return t.id; end if;
  select coalesce(max(position),0)+1 into next_position from public.project_tasks where project_id=p_project_id and status=p_status;
  update public.project_tasks set status=p_status,position=next_position,updated_by=auth.uid() where id=t.id;
  return t.id;
end;
$$;

create function public.delete_project_task(p_project_id uuid,p_task_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  perform public.lock_native_board(p_project_id);
  delete from public.project_tasks where id=p_task_id and project_id=p_project_id;
  if not found then raise exception 'This task is no longer available.'; end if;
  return p_task_id;
end;
$$;

create function public.set_project_board(p_project_id uuid,p_mode text,p_url text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
  perform public.assert_active();
  select * into p from public.projects where id=p_project_id for update;
  perform public.assert_active();
  if p.id is null or (p.owner_id is distinct from auth.uid() and not public.workspace_admin()) then
    raise exception 'Only the owner or an admin can choose the project board.' using errcode='42501';
  end if;
  if p.work_status='completed' then raise exception 'Completed project boards are read-only.'; end if;
  if p_mode is null or p_mode not in ('native','external') then raise exception 'Choose a native or external board.'; end if;
  if p_mode='external' and (p_url is null or not public.valid_deliverable_url(btrim(p_url))) then
    raise exception 'Enter a full HTTP or HTTPS board link without embedded credentials.';
  end if;
  update public.projects set board_mode=p_mode,external_board_url=case when p_mode='external' then btrim(p_url) else external_board_url end where id=p_project_id;
  return p_project_id;
end;
$$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature,p.proname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array['lock_native_board','save_project_task','move_project_task','delete_project_task','set_project_board']) loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.proname<>'lock_native_board' then execute format('grant execute on function %s to authenticated',f.signature); end if;
  end loop;
end $$;
commit;
