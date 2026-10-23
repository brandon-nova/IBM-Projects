import type { Project } from "@/lib/database.types";
import type { WorkspaceData } from "@/lib/data";
import { assignOwner, reviewPublication } from "@/app/actions";
import { ActionForm } from "./forms";
import { createClient } from "@/lib/supabase/server";
import { OwnerPicker } from "./owner-picker";
import type { Candidate } from "@/lib/database.types";

export async function ApprovalControls({ project }: { project: Project; data: WorkspaceData }) {
  const client=await createClient();
  const candidates:Candidate[]=[];
  for(let offset=0;;offset+=100) {
    const {data,error}=await client.rpc("assignment_candidates",{p_project_id:project.id,p_offset:offset,p_limit:100});
    if(error) throw new Error("Active owners could not be loaded.");
    candidates.push(...data); if(data.length<100) break;
  }
  return <div className="approval-controls">
    <ActionForm action={assignOwner} label={project.owner_id ? "Change owner" : "Assign owner"}>
      <input type="hidden" name="project_id" value={project.id} />
      <OwnerPicker id={`owner-${project.id}`} title={project.title} ownerId={project.owner_id} candidates={candidates} />
    </ActionForm>
    {project.approval_status === "pending" && <div className="flex flex-wrap gap-3">
      <ActionForm action={reviewPublication} label="Approve publication" variant="default" disabled={!project.owner_id}><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="approve" value="true" /></ActionForm>
      <ActionForm action={reviewPublication} label="Reject proposal"><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="approve" value="false" /></ActionForm>
    </div>}
    {!project.owner_id && <p className="field-hint">Assign an official owner before approving publication.</p>}
  </div>;
}
