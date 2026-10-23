import Link from "next/link";
import type { WorkspaceData } from "@/lib/data";
import { personName, projectTags } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { respondInvitation } from "@/app/assignment-actions";
import { ActionForm } from "./forms";
import { SkillTags } from "./projects";
export async function SuggestedProjects({ data }: { data: WorkspaceData }) {
  const client=await createClient();
  const {data:ids,error}=await client.rpc("pending_project_suggestions");
  if(error) throw new Error("Suggested projects could not be loaded.");
  const invitations=data.requests.filter((r) => ids.includes(r.id));
  if(!invitations.length) return null;
  return <section className="suggested-projects" aria-labelledby="suggested-title"><h2 id="suggested-title">Suggested for you</h2><div className="project-grid">{invitations.map((r) => {
    const p=data.projects.find((p) => p.id===r.project_id); if(!p) return null;
    return <article className="project-card" key={r.id}><p className="eyebrow">{r.suggestion_kind==="training" ? "Learning opportunity" : "Invitation to contribute"}</p><div className="project-card-copy"><h3>{p.title}</h3><p className="muted line-clamp-2">{p.description}</p></div><SkillTags skills={projectTags(data,p.id)} /><p className="muted text-xs">Owner: {personName(data,p.owner_id)}{p.estimated_hours ? ` · About ${p.estimated_hours} hours per week` : ""}</p>{r.reason && <p>{r.reason}</p>}<div className="flex flex-wrap gap-3"><ActionForm action={respondInvitation} label="Accept" variant="default"><input type="hidden" name="request_id" value={r.id} /><input type="hidden" name="accept" value="true" /></ActionForm><ActionForm action={respondInvitation} label="Decline"><input type="hidden" name="request_id" value={r.id} /><input type="hidden" name="accept" value="false" /></ActionForm><Link className="text-link self-center text-xs" href={`/projects/${p.id}`}>View details</Link></div></article>;
  })}</div></section>;
}
