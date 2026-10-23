import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { loadWorkspace, personName, projectTags } from "@/lib/data";
import { editsProject, managesProject } from "@/lib/project-permissions";
import { loadAssignmentData } from "@/lib/assignment-data";
import { loadBoardTasks } from "@/lib/board-data";
import { ProjectBoard } from "@/components/project-board";
import { Assignments } from "@/components/assignments";
import { createClient } from "@/lib/supabase/server";
import { ProjectLinks } from "@/components/project-links";
import { initials, labels } from "@/lib/domain";
import { ActionForm, DeliverableForm } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkillTags } from "@/components/projects";
import { ApprovalControls } from "@/components/approval-controls";
import { completeProject, requestJoin, requestPublication, reviewDeliverable, reviewJoin, startProject } from "@/app/actions";

export default async function ProjectDetails({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const data = await loadWorkspace();
  const p = data.projects.find((p) => p.id === projectId);
  if (!p) notFound();
  const creator = p.creator_id === data.viewer.id;
  const members = data.members.filter((m) => m.project_id === p.id && m.membership_status === "active");
  const member = members.some((m) => m.user_id === data.viewer.id);
  const completed = p.work_status === "completed";
  const editable = editsProject(p,data.viewer);
  const manager = managesProject(p,data.viewer);
  const client=await createClient();
  const {data:links,error:linkError}=await client.from("project_links").select("*").eq("project_id",p.id).order("created_at");
  if(linkError) throw new Error("Project links could not be loaded.");
  const assignmentData=manager ? await loadAssignmentData(p.id) : null;
  const tasks=await loadBoardTasks(p.id);
  const boardPeople=data.profiles.filter((person) => members.some((m) => m.user_id===person.user_id)||tasks.some((task) => task.assignee_id===person.user_id))
    .map((person) => ({user_id:person.user_id,display_name:person.display_name,active:members.some((m) => m.user_id===person.user_id)}));
  const requests = data.requests.filter((r) => r.project_id === p.id && r.status === "pending" && r.request_type === "join");
  const pending = requests.some((r) => r.user_id === data.viewer.id);
  const submissions = data.deliverables.filter((d) => d.project_id === p.id);
  const own = submissions.find((d) => d.contributor_id === data.viewer.id);
  const accepted = submissions.filter((d) => d.status === "accepted");
  return <div className="stack">
    <Link href="/projects" className="text-xs muted inline-flex items-center gap-2 self-start"><ArrowLeft size={14} />All projects</Link>
    <header className="project-detail-heading"><div className="page-heading project-heading"><div><div className="flex flex-wrap gap-2 mb-3"><Badge tone={completed ? "blue" : "neutral"}>{labels[p.work_status]}</Badge>{p.visibility === "private" && <Badge tone="amber"><LockKeyhole size={11} className="mr-1" />Private · {labels[p.approval_status]}</Badge>}</div><h1>{p.title}</h1></div>{editable && <Button asChild variant="outline"><Link href={`/projects/${p.id}/edit`}>Edit project</Link></Button>}</div>
    <SkillTags skills={projectTags(data,p.id)} /></header>
    <section className="panel project-summary"><h2 className="panel-title">Description</h2><p className="detail-description">{p.description}</p>{p.estimated_hours && <p className="muted mt-4 inline-flex items-center gap-2 text-xs"><Clock3 size={14} />Estimated hours per week: {p.estimated_hours}</p>}</section>
    <ProjectBoard project={p} tasks={tasks} people={boardPeople} editable={member||data.viewer.role==="admin"} manager={manager} />
    <div className="two-columns"><div className="stack">
      <ProjectLinks projectId={p.id} links={links ?? []} editable={manager&&!completed} />
      {p.visibility === "private" && (creator || manager) && <section className="panel stack-sm"><h2>{p.approval_status === "pending" ? "Waiting for approval" : p.approval_status === "rejected" ? "Make a few changes and try again" : "Ready to share this opportunity?"}</h2><p className="muted">An admin assigns the official owner and approves publication. Until then, your proposal stays private.</p>{["draft","rejected"].includes(p.approval_status) && !completed && <ActionForm action={requestPublication} label="Request publication" variant="default"><input type="hidden" name="project_id" value={p.id} /></ActionForm>}</section>}
      {manager && requests.length > 0 && !completed && <section className="panel"><h2 className="panel-title">People who want to help</h2><div className="stack">{requests.map((r) => <div className="stack-sm" key={r.id}><Link className="text-link" href={`/people/${r.user_id}`}>{personName(data,r.user_id)}</Link><div className="flex flex-wrap gap-3"><ActionForm action={reviewJoin} label="Accept request" variant="default"><input type="hidden" name="request_id" value={r.id} /><input type="hidden" name="accept" value="true" /></ActionForm><ActionForm action={reviewJoin} label="Decline request"><input type="hidden" name="request_id" value={r.id} /><input type="hidden" name="accept" value="false" /></ActionForm></div></div>)}</div></section>}
      {member && !completed && own?.status !== "accepted" && <section className="panel"><h2 className="panel-title">{own ? "Your contribution" : "Have something to show?"}</h2>{own?.status === "changes_requested" && <p className="notice notice-error mb-6">Your owner requested changes: {own.feedback}</p>}{own?.status === "submitted" && <p className="notice notice-success mb-6">Your work is awaiting review. You can update it until it is accepted.</p>}<DeliverableForm projectId={p.id} defaults={own ? { url: own.url, summary: own.summary, outcome: own.outcome } : undefined} /></section>}
      <section className="panel"><h2 className="panel-title">{completed ? "What we accomplished" : "Contributions"}</h2>{submissions.length === 0 ? <p className="muted">Useful work starts with one contribution. Participants can submit a link and a short summary.</p> : submissions.map((d) => <article key={d.id} className="review-card"><div className="review-header"><Link className="font-semibold" href={`/people/${d.contributor_id}`}>{personName(data,d.contributor_id)}</Link><Badge tone={d.status === "accepted" ? "blue" : "amber"}>{labels[d.status]}</Badge></div><p className="whitespace-pre-wrap break-words mb-3">{d.summary}</p><a className="proof-link" href={d.url} target="_blank" rel="noopener noreferrer">View deliverable<ArrowUpRight size={14} /></a>{d.outcome && <div className="mt-4"><p className="meta-label">Outcome</p><p className="whitespace-pre-wrap break-words">{d.outcome}</p></div>}{d.status === "accepted" && <p className="text-xs mt-4 text-primary inline-flex items-center gap-2"><CheckCircle2 size={14} />Confirmed useful by {personName(data,d.reviewed_by)}{d.reviewed_at ? ` · ${new Date(d.reviewed_at).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}` : ""}</p>}{d.feedback && d.status !== "accepted" && <p className="notice notice-error mt-4">{d.feedback}</p>}
        {manager && !completed && d.status !== "accepted" && <div className="stack-sm mt-5"><ActionForm action={reviewDeliverable} label="Accept contribution" variant="default"><input type="hidden" name="deliverable_id" value={d.id} /><input type="hidden" name="accept" value="true" /><label className="filter-check w-full"><input type="checkbox" name="confirm_useful" value="yes" required />I confirm this contribution was useful.</label></ActionForm><ActionForm action={reviewDeliverable} label="Request changes"><input type="hidden" name="deliverable_id" value={d.id} /><input type="hidden" name="accept" value="false" /><label htmlFor={`feedback-${d.id}`} className="sr-only">What needs to change?</label><textarea id={`feedback-${d.id}`} className="field-input" name="feedback" placeholder="What needs to change?" required maxLength={1000} rows={2} /></ActionForm></div>}
      </article>)}</section>
    </div><aside className="stack">
      <section className="panel stack"><div><p className="meta-label">Official owner</p>{p.owner_id ? <Link href={`/people/${p.owner_id}`} className="person-row"><span className="avatar">{initials(personName(data,p.owner_id))}</span><span>{personName(data,p.owner_id)}</span></Link> : <p className="muted">Not assigned yet</p>}</div><div><p className="meta-label">Proposed by</p><Link href={`/people/${p.creator_id}`}>{personName(data,p.creator_id)}</Link></div><div><p className="meta-label">Participants · {members.length}</p><div className="member-list">{members.map((m) => <Link key={m.user_id} href={`/people/${m.user_id}`} className="person-row"><span className="avatar">{initials(personName(data,m.user_id))}</span><span className="text-xs">{personName(data,m.user_id)}</span></Link>)}</div></div>
      {!member && p.visibility === "organization" && !completed && (pending ? <p className="notice notice-success">Your request is waiting for the owner.</p> : <ActionForm action={requestJoin} label="Request to join" variant="default"><input type="hidden" name="project_id" value={p.id} /></ActionForm>)}{member && <p className="text-xs text-primary">You’re a participant.</p>}</section>
      {manager && !completed && <section className="panel stack-sm"><h2>Project progress</h2>{p.work_status === "open" && <ActionForm action={startProject} label="Mark in progress"><input type="hidden" name="project_id" value={p.id} /></ActionForm>}{accepted.length ? <><p className="muted text-xs">Accepted work is ready to become a verified contribution.</p><ActionForm action={completeProject} label="Complete project" variant="default"><input type="hidden" name="project_id" value={p.id} /></ActionForm></> : <p className="muted text-xs">Accept at least one contribution before completing the project.</p>}</section>}
      {completed && <section className="panel stack-sm"><CheckCircle2 className="text-primary" size={24} /><h2>Useful work, confirmed.</h2><p className="muted text-xs">{accepted.length} verified {accepted.length === 1 ? "contribution" : "contributions"}. Completed by {personName(data,p.completed_by)}.</p></section>}
      {data.viewer.role === "admin" && !completed && <section className="panel"><h2>Admin controls</h2><ApprovalControls project={p} data={data} /></section>}
    </aside></div>
    {assignmentData && <details className="panel"><summary>Manage team and invitations</summary><div className="mt-6"><Assignments key={p.id} data={assignmentData} /></div></details>}
  </div>;
}
