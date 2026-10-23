import type { Project } from "./database.types";
import type { Role } from "./domain";
type Actor = { id: string; role: Role };
export function managesProject(project: Project, actor: Actor) { return project.owner_id === actor.id || actor.role === "admin"; }
export function editsProject(project: Project, actor: Actor) {
  return project.work_status !== "completed" && (managesProject(project,actor) || (!project.owner_id && project.creator_id === actor.id && project.approval_status !== "approved"));
}
export function acceptsInvitations(project: Project) {
  return project.approval_status === "approved" && project.visibility === "organization" && project.work_status !== "completed" && Boolean(project.owner_id);
}
