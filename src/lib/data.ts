import "server-only";
import { cache } from "react";
import { requireViewer } from "./auth";
import { createClient } from "./supabase/server";

async function allRows<T>(query: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error || !data) throw new Error("Workspace data could not be loaded. Please try again.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

// React cache is scoped to this server request, never shared between users.
export const loadWorkspace = cache(async () => {
  const viewer = await requireViewer();
  const client = await createClient();
  const [profiles, skills, userSkills, availability, projects, projectSkills, members, requests, deliverables] = await Promise.all([
    allRows(() => client.from("profiles").select("*").order("display_name").order("user_id")),
    allRows(() => client.from("skills").select("*").order("name").order("id")),
    allRows(() => client.from("user_skills").select("*").order("user_id").order("skill_id").order("type")),
    allRows(() => client.from("user_availability").select("*").order("user_id")),
    allRows(() => client.from("projects").select("*").order("created_at", { ascending: false }).order("id")),
    allRows(() => client.from("project_skills").select("*").order("project_id").order("skill_id")),
    allRows(() => client.from("project_members").select("*").order("project_id").order("user_id")),
    allRows(() => client.from("project_requests").select("*").order("id")),
    allRows(() => client.from("project_deliverables").select("*").order("id")),
  ]);
  return { viewer, profiles, skills, userSkills, availability, projects, projectSkills, members, requests, deliverables };
});
export type WorkspaceData = Awaited<ReturnType<typeof loadWorkspace>>;
export function projectTags(data: WorkspaceData, id: string) {
  const ids = new Set(data.projectSkills.filter((s) => s.project_id === id).map((s) => s.skill_id));
  return data.skills.filter((s) => ids.has(s.id));
}
export function personTags(data: WorkspaceData, id: string, type: "existing" | "learning") {
  const ids = new Set(data.userSkills.filter((s) => s.user_id === id && s.type === type).map((s) => s.skill_id));
  return data.skills.filter((s) => ids.has(s.id));
}
export function personName(data: WorkspaceData, id: string | null) {
  return data.profiles.find((p) => p.user_id === id)?.display_name ?? "Not assigned";
}
