import Link from "next/link";
import { loadAssignmentData } from "@/lib/assignment-data";
import { Assignments } from "@/components/assignments";
import { ProjectSwitcher } from "@/components/project-switcher";
import { SkillAdmin } from "@/components/skill-admin";
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

export default async function Admin({searchParams}:{searchParams:Promise<{tab?:string;project?:string}>}) {
  const params=await searchParams;
  const tab=["approvals","assignments","skills","access"].includes(params.tab ?? "") ? params.tab : "approvals";
  await requireAdmin();
  const data = await loadWorkspace();
  const client = await createClient();
  const [accessResult, rolesResult] = await Promise.all([
    client.from("approved_emails").select("*").order("email"), client.from("user_roles").select("*"),
  ]);
  if (accessResult.error || rolesResult.error || !accessResult.data || !rolesResult.data) throw new Error("Could not load administrator controls.");
  const selected=params.project ?? data.projects.find((p) => p.approval_status==="approved" && p.work_status!=="completed")?.id ?? data.projects[0]?.id ?? "";
  const assignment=tab==="assignments" && selected ? await loadAssignmentData(selected) : null;
  const skillRequests=tab==="skills" ? await client.from("skill_requests").select("*").order("created_at",{ascending:false}) : null;
  if(skillRequests?.error) throw new Error("Skill requests could not be loaded.");
  const pending = data.projects.filter((p) => p.approval_status === "pending");
  return <>
    <PageTitle title="Administration" action={<div className="flex flex-wrap gap-3"><Button asChild><Link href="/projects/new">Create a project</Link></Button><Button asChild variant="outline"><Link href="/projects">Manage projects</Link></Button></div>} />
    <nav className="admin-tabs" aria-label="Administration">{[["approvals","Approvals"],["assignments","Assignments"],["skills","Skills"],["access","Access"]].map(([key,label]) => <Link key={key} href={`/admin?tab=${key}`} aria-current={tab===key ? "page" : undefined}>{label}</Link>)}</nav>
    {tab==="assignments" && <><ProjectSwitcher projects={data.projects.map((p) => ({id:p.id,title:p.title}))} selected={selected} />{assignment ? <Assignments key={assignment.project.id} data={assignment} /> : <p className="panel muted">Select a project to manage its team.</p>}</>}
    {tab==="skills" && <SkillAdmin skills={data.skills} requests={skillRequests?.data ?? []} />}
    {tab==="approvals" && <>

    {pending.length ? <div className="grid md:grid-cols-2 gap-6">{pending.map((p) => <article className="approval-card" key={p.id}><div className="flex flex-wrap justify-between gap-3 mb-3"><Badge tone="amber">Publication requested</Badge><Link className="text-link text-xs" href={`/projects/${p.id}`}>Open project</Link></div><h2>{p.title}</h2><p className="muted">{p.description}</p><SkillTags skills={projectTags(data,p.id)} /><p className="text-xs muted mt-4">Proposed by {personName(data,p.creator_id)} · Requested: organization-wide</p><p className="text-xs mt-2">Official owner: {personName(data,p.owner_id)}</p><ApprovalControls project={p} data={data} /></article>)}</div> : <div className="panel"><h2>All caught up.</h2><p className="muted mt-2">New publication requests will appear here.</p></div>}
    </>}
    {tab==="access" && <section className="panel"><h2>Manage workspace access</h2><p className="muted text-sm mt-4 mb-5">Approve individual email addresses. Revocation blocks workspace data and actions even for users who are already signed in.</p>
      <ActionForm action={manageAccess} label="Approve email" variant="default" className="mb-7"><label htmlFor="approve-email" className="sr-only">Email to approve</label><input className="field-input flex-1 min-w-48" id="approve-email" name="email" type="email" placeholder="person@example.com" required maxLength={254} /><input type="hidden" name="active" value="true" /></ActionForm>
      {accessResult.data.map((a) => { const role = rolesResult.data.find((r) => r.user_id === a.user_id)?.role; return <div key={a.email} className="access-row"><div><p>{a.user_id ? personName(data,a.user_id) : "Not registered"}</p><p className="text-xs muted">{a.email}</p><Badge tone={a.active ? "blue" : "neutral"}>{a.active ? "Approved" : "Revoked"}{role ? ` · ${role}` : ""}</Badge></div><div className="flex flex-wrap gap-3"><ActionForm action={manageAccess} label={a.active ? "Revoke access" : "Restore access"}><input type="hidden" name="email" value={a.email} /><input type="hidden" name="active" value={String(!a.active)} /></ActionForm>{a.user_id && a.active && <ActionForm action={setUserRole} label={role === "admin" ? "Make member" : "Make admin"}><input type="hidden" name="user_id" value={a.user_id} /><input type="hidden" name="role" value={role === "admin" ? "member" : "admin"} /></ActionForm>}</div></div>; })}
    </section>}
  </>;
}
