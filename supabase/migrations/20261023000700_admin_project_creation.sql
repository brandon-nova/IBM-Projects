-- Keep employee proposals private; admins can publish atomically at creation.
begin;
create function public.limit_new_project_description() returns trigger
language plpgsql set search_path='' as $$
begin
  if char_length(btrim(new.description))>300 then raise exception 'Use up to 300 characters for a new project description.'; end if;
  return new;
end;
$$;
revoke all on function public.limit_new_project_description() from public,anon,authenticated;
create trigger limit_new_project_description before insert on public.projects
  for each row execute function public.limit_new_project_description();

create function public.admin_project_owners(p_offset integer default 0,p_limit integer default 100)
returns table(user_id uuid,display_name text)
language plpgsql security definer set search_path='' as $$
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  return query select pr.user_id,pr.display_name from public.profiles pr
    where public.account_eligible(pr.user_id) order by pr.display_name,pr.user_id
    offset greatest(0,coalesce(p_offset,0)) limit least(100,greatest(1,coalesce(p_limit,100)));
end;
$$;

create function public.create_published_project(p_title text,p_description text,p_skill_ids uuid[],p_estimated_hours numeric default null,p_owner_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; selected_owner uuid := coalesce(p_owner_id,auth.uid());
begin
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  if not public.account_eligible(selected_owner) then raise exception 'Choose an active, verified project owner.'; end if;
  result := public.create_project_with_skills(p_title,p_description,p_skill_ids,p_estimated_hours);
  perform public.assign_owner(result,selected_owner);
  if not public.workspace_admin() then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  update public.projects set approval_status='approved',visibility='organization' where id=result;
  return result;
end;
$$;
revoke all on function public.admin_project_owners(integer,integer) from public,anon,authenticated;
grant execute on function public.admin_project_owners(integer,integer) to authenticated;
revoke all on function public.create_published_project(text,text,uuid[],numeric,uuid) from public,anon,authenticated;
grant execute on function public.create_published_project(text,text,uuid[],numeric,uuid) to authenticated;
commit;
