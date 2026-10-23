"use server";
import { z } from "zod";
import { mutate } from "@/lib/action-mutation";
import { idSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rankCandidates, type MatchKind } from "@/lib/assignment-matching";
import type { Candidate } from "@/lib/database.types";
export async function inviteMembers(_: ActionState,form: FormData) {
  return mutate((client) => client.rpc("invite_project_members", {
    p_project_id:idSchema.parse(form.get("project_id")),p_user_ids:z.array(idSchema).min(1,"Select an employee.").max(25).parse(form.getAll("user_id")),
    p_kind:z.enum(["contribution","training"]).parse(form.get("kind")), p_reason:z.string().trim().max(360).parse(form.get("reason") ?? ""),p_reinvite:form.get("reinvite")==="yes",
  }),"Invitations sent. Employees must accept before joining.");
}
export async function respondInvitation(_: ActionState,form: FormData) {
  return mutate((client) => client.rpc("respond_project_invitation", { p_request_id:idSchema.parse(form.get("request_id")),p_accept:z.enum(["true","false"]).parse(form.get("accept"))==="true" }),"Invitation response saved.");
}
export async function cancelInvitation(_: ActionState,form: FormData) {
  return mutate((client) => client.rpc("cancel_project_invitation", { p_request_id:idSchema.parse(form.get("request_id")) }),"Invitation canceled.");
}
export async function removeMember(_: ActionState,form: FormData) {
  return mutate((client) => {
    if(form.get("confirm")!=="yes") throw new z.ZodError([{code:"custom",path:[],message:"Confirm removal first. Their work will be preserved."}]);
    return client.rpc("remove_project_member", { p_project_id:idSchema.parse(form.get("project_id")),p_user_id:idSchema.parse(form.get("user_id")) });
  },"Participant removed. Work and accepted evidence are preserved.");
}
export async function searchAssignmentCandidates(projectId: string,query: string,offset=0) {
  await requireViewer();
  const client=await createClient();
  const result=await client.rpc("assignment_candidates", { p_project_id:idSchema.parse(projectId),p_query:z.string().max(80).parse(query),p_offset:z.number().int().min(0).parse(offset),p_limit:50 });
  if(result.error) throw new Error("Employees could not be loaded. Check access and try again.");
  return result.data;
}
export async function suggestAssignmentCandidates(projectId: string,kind: MatchKind) {
  await requireViewer();
  idSchema.parse(projectId); z.enum(["contribution","training"]).parse(kind);
  const client=await createClient();
  const [skills,members,requests]=await Promise.all([
    client.from("project_skills").select("skill_id").eq("project_id",projectId),
    client.from("project_members").select("user_id").eq("project_id",projectId).eq("membership_status","active"),
    client.from("project_requests").select("user_id").eq("project_id",projectId).eq("request_type","invitation"),
  ]);
  if(skills.error || members.error || requests.error) throw new Error("Suggestions could not be loaded.");
  const candidates: Candidate[]=[];
  for(let offset=0;;offset+=100) {
    const {data,error}=await client.rpc("assignment_candidates", { p_project_id:projectId,p_offset:offset,p_limit:100 });
    if(error) throw new Error("Suggestions could not be loaded. Check your access.");
    candidates.push(...data); if(data.length<100) break;
  }
  return rankCandidates(candidates,skills.data.map((s) => s.skill_id),kind,new Set([...members.data,...requests.data].map((r) => r.user_id))).slice(0,25);
}
