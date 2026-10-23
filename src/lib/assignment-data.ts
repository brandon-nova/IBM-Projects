import "server-only";
import { createClient } from "./supabase/server";
import { requireViewer } from "./auth";
import { managesProject } from "./project-permissions";
import type { Candidate, Member, Project, Request, RequestEvent, Skill } from "./database.types";
export type AssignmentData = { project: Project; canSearchEmail: boolean; skills: Skill[]; members: (Member & { name: string })[]; requests: (Request & { name: string; sender_name:string })[]; events: (RequestEvent & { actor_name:string })[]; candidates: Candidate[] };
export async function loadAssignmentData(projectId: string): Promise<AssignmentData | null> {
  const viewer=await requireViewer(); const client=await createClient();
  const {data:project,error}=await client.from("projects").select("*").eq("id",projectId).maybeSingle();
  if(error) throw new Error("Project could not be loaded.");
  if(!project || !managesProject(project,viewer)) return null;
  const [skills,skillIds,members,requests,candidates]=await Promise.all([
    client.from("skills").select("*"),client.from("project_skills").select("skill_id").eq("project_id",projectId),
    client.from("project_members").select("*").eq("project_id",projectId),client.from("project_requests").select("*").eq("project_id",projectId).eq("request_type","invitation").order("updated_at",{ascending:false}),
    client.rpc("assignment_candidates",{p_project_id:projectId,p_limit:50}),
  ]);
  if(skills.error||skillIds.error||members.error||requests.error||candidates.error) throw new Error("Team could not be loaded.");
  const events=requests.data.length ? await client.from("project_request_events").select("*").in("request_id",requests.data.map((r) => r.id)).order("created_at",{ascending:false}).limit(100) : {data:[],error:null};
  const ids=[...new Set([...members.data.map((m) => m.user_id),...requests.data.flatMap((r) => [r.user_id,r.invited_by,r.canceled_by]),...(events.data ?? []).map((e) => e.actor_id)].filter((id):id is string => Boolean(id)))];
  const names=ids.length ? await client.from("profiles").select("user_id,display_name").in("user_id",ids) : {data:[],error:null};
  if(names.error||events.error) throw new Error("Team history could not be loaded.");
  const name=(uid:string) => names.data?.find((n) => n.user_id===uid)?.display_name ?? "Workspace member";
  return {project,canSearchEmail:viewer.role==="admin",skills:skills.data.filter((s) => skillIds.data.some((i) => i.skill_id===s.id)),members:members.data.map((m) => ({...m,name:name(m.user_id)})),requests:requests.data.map((r) => ({...r,name:name(r.user_id),sender_name:r.invited_by ? name(r.invited_by) : "Workspace member"})),events:(events.data ?? []).map((e) => ({...e,actor_name:name(e.actor_id)})),candidates:candidates.data};
}
