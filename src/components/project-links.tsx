import { ArrowUpRight } from "lucide-react";
import type { ProjectLink } from "@/lib/database.types";
import { saveLink,deleteLink } from "@/app/project-link-actions";
import { ActionForm } from "./forms";
export function ProjectLinks({ projectId,links,editable }: { projectId:string;links:ProjectLink[];editable:boolean }) {
  return <section className="panel project-links"><h2 className="panel-title">Links</h2><ul>{links.map((link) => <li key={link.id}><a className="proof-link" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={14} aria-hidden="true" /></a>{editable && <details><summary className="text-xs muted">Edit link</summary><LinkEditor projectId={projectId} link={link} /><ActionForm action={deleteLink} label="Remove link"><input type="hidden" name="link_id" value={link.id} /></ActionForm></details>}</li>)}</ul>{!links.length && <p className="muted text-xs">No links yet.</p>}{editable && links.length<10 && <details className="mt-4"><summary>Add a link</summary><LinkEditor projectId={projectId} /></details>}</section>;
}
function LinkEditor({projectId,link}:{projectId:string;link?:ProjectLink}) {
  return <ActionForm action={saveLink} label={link ? "Save link" : "Add link"} className="mt-4 mb-4"><input type="hidden" name="project_id" value={projectId} />{link && <input type="hidden" name="link_id" value={link.id} />}<label className="field w-full">Label<input className="field-input" name="label" required maxLength={80} defaultValue={link?.label} placeholder="Linear board" /></label><label className="field w-full">URL<input className="field-input" name="url" type="url" required maxLength={2048} defaultValue={link?.url} placeholder="https://…" /></label></ActionForm>;
}
