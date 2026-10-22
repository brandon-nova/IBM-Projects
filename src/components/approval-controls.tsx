import type { Project } from "@/lib/database.types";
import type { WorkspaceData } from "@/lib/data";
import { assignOwner, reviewPublication } from "@/app/actions";
import { ActionForm } from "./forms";

export function ApprovalControls({ project, data }: { project: Project; data: WorkspaceData }) {
  return <div className="approval-controls">
    <ActionForm action={assignOwner} label={project.owner_id ? "Change owner" : "Assign owner"}>
      <input type="hidden" name="project_id" value={project.id} />
      <label className="sr-only" htmlFor={`owner-${project.id}`}>Official owner for {project.title}</label>
      <select className="field-input" id={`owner-${project.id}`} name="owner_id" defaultValue={project.owner_id ?? ""} required><option value="" disabled>Choose official owner</option>{data.profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select>
    </ActionForm>
    {project.approval_status === "pending" && <div className="flex flex-wrap gap-3">
      <ActionForm action={reviewPublication} label="Approve publication" variant="default" disabled={!project.owner_id}><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="approve" value="true" /></ActionForm>
      <ActionForm action={reviewPublication} label="Reject proposal"><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="approve" value="false" /></ActionForm>
    </div>}
    {!project.owner_id && <p className="field-hint">Assign an official owner before approving publication.</p>}
  </div>;
}
