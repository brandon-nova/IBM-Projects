import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadWorkspace, personName, projectTags } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/shell";
import { ApprovalControls } from "@/components/approval-controls";
import { SkillTags } from "@/components/projects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/forms";
import { manageAccess, setUserRole } from "@/app/actions";

export default async function Admin() {
  await requireAdmin();
  const data = await loadWorkspace();
  const client = await createClient();
  const [accessResult, rolesResult] = await Promise.all([
    client.from("approved_emails").select("*").order("email"), client.from("user_roles").select("*"),
  ]);
  if (accessResult.error || rolesResult.error || !accessResult.data || !rolesResult.data) throw new Error("Could not load administrator controls.");
  const pending = data.projects.filter((p) => p.approval_status === "pending");
  return <>
    <PageTitle eyebrow="Keep good opportunities moving" title="Project approvals" description="Give each project a clear owner before sharing it with the workspace." action={<Button asChild variant="outline"><Link href="/projects">Manage projects</Link></Button>} />
    {pending.length ? <div className="grid md:grid-cols-2 gap-6">{pending.map((p) => <article className="approval-card" key={p.id}><div className="flex flex-wrap justify-between gap-3 mb-3"><Badge tone="amber">Publication requested</Badge><Link className="text-link text-xs" href={`/projects/${p.id}`}>Open project</Link></div><h2>{p.title}</h2><p className="muted">{p.description}</p><SkillTags skills={projectTags(data,p.id)} /><p className="text-xs muted mt-4">Proposed by {personName(data,p.creator_id)} · Requested: organization-wide</p><p className="text-xs mt-2">Official owner: {personName(data,p.owner_id)}</p><ApprovalControls project={p} data={data} /></article>)}</div> : <div className="panel"><h2>All caught up.</h2><p className="muted mt-2">New publication requests will appear here.</p></div>}
    <details className="panel admin-access"><summary>Manage workspace access</summary><p className="muted text-sm mt-4 mb-5">Approve individual email addresses. Revocation blocks workspace data and actions even for users who are already signed in.</p>
      <ActionForm action={manageAccess} label="Approve email" variant="default" className="mb-7"><label htmlFor="approve-email" className="sr-only">Email to approve</label><input className="field-input flex-1 min-w-48" id="approve-email" name="email" type="email" placeholder="person@example.com" required maxLength={254} /><input type="hidden" name="active" value="true" /></ActionForm>
      {accessResult.data.map((a) => { const role = rolesResult.data.find((r) => r.user_id === a.user_id)?.role; return <div key={a.email} className="access-row"><div><p>{a.user_id ? personName(data,a.user_id) : "Not registered"}</p><p className="text-xs muted">{a.email}</p><Badge tone={a.active ? "blue" : "neutral"}>{a.active ? "Approved" : "Revoked"}{role ? ` · ${role}` : ""}</Badge></div><div className="flex flex-wrap gap-3"><ActionForm action={manageAccess} label={a.active ? "Revoke access" : "Restore access"}><input type="hidden" name="email" value={a.email} /><input type="hidden" name="active" value={String(!a.active)} /></ActionForm>{a.user_id && a.active && <ActionForm action={setUserRole} label={role === "admin" ? "Make member" : "Make admin"}><input type="hidden" name="user_id" value={a.user_id} /><input type="hidden" name="role" value={role === "admin" ? "member" : "admin"} /></ActionForm>}</div></div>; })}
    </details>
  </>;
}
