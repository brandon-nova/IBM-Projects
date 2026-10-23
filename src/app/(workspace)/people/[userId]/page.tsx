import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { loadWorkspace, personTags } from "@/lib/data";
import { hasVerifiedCredit, initials } from "@/lib/domain";
import { PageTitle } from "@/components/shell";
import { DirectoryVisibilityForm, ProfileForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { ProjectCard, SkillTags } from "@/components/projects";

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { userId } = await params;
  const { edit } = await searchParams;
  const data = await loadWorkspace();
  const person = data.profiles.find((p) => p.user_id === userId);
  if (!person) notFound();
  const self = userId === data.viewer.id;
  const existing = personTags(data,userId,"existing");
  const learning = personTags(data,userId,"learning");
  const availability = data.availability.find((a) => a.user_id === userId)?.available_hours;
  if (self && edit === "1") return <div className="max-w-2xl mx-auto"><PageTitle title="Make this yours." description="Tell people what you can help with and what you’d like to learn." action={<Button asChild variant="outline"><Link href={`/people/${userId}`}>View profile</Link></Button>} /><div className="panel"><ProfileForm defaults={{ display_name: person.display_name, bio: person.bio, existing_skills: existing.map((s) => s.name).join(", "), learning_skills: learning.map((s) => s.name).join(", "), available_hours: availability?.toString() ?? "" }} /></div>{data.viewer.role === "admin" && <DirectoryVisibilityForm hidden={person.hidden_from_people} />}</div>;
  const memberships = new Set(data.members.filter((m) => m.user_id === userId && m.membership_status === "active").map((m) => m.project_id));
  const verified = data.projects.filter((p) => hasVerifiedCredit(p.work_status,data.deliverables.find((d) => d.project_id === p.id && d.contributor_id === userId)?.status));
  const joined = data.projects.filter((p) => memberships.has(p.id) && !verified.some((v) => v.id === p.id));
  const created = data.projects.filter((p) => p.creator_id === userId);
  return <>
    <div className="profile-heading"><span className="avatar avatar-large">{initials(person.display_name)}</span><div><p className="eyebrow">{self ? "Your profile" : "Workspace profile"}</p><h1>{person.display_name}</h1>{person.bio && <p className="muted max-w-xl whitespace-pre-wrap">{person.bio}</p>}</div>{self && <Button asChild variant="outline" className="ml-auto"><Link href={`/people/${userId}?edit=1`}>Edit profile</Link></Button>}</div>
    <div className="panel grid md:grid-cols-3 gap-7"><div><p className="meta-label">Skills</p>{existing.length ? <SkillTags skills={existing} people /> : <p className="muted text-xs">No skills added yet.</p>}</div><div><p className="meta-label">Wants to learn</p>{learning.length ? <SkillTags skills={learning} /> : <p className="muted text-xs">Room for a new interest.</p>}</div><div><p className="meta-label">Availability</p><p>{availability == null ? "Not specified" : `${availability} hours / week`}</p></div></div>
    <h2 className="section-heading flex items-center gap-2"><CheckCircle2 size={19} className="text-primary" />Verified contributions</h2>
    {verified.length ? <div className="project-grid">{verified.map((p) => <ProjectCard key={p.id} project={p} data={data} verified />)}</div> : <p className="muted">{self ? "Your accepted work will appear here when the owner completes the project." : "No visible verified contributions yet."}</p>}
    <h2 className="section-heading">Projects joined</h2>{joined.length ? <div className="project-grid">{joined.map((p) => <ProjectCard key={p.id} project={p} data={data} />)}</div> : <p className="muted">No other visible projects yet.</p>}
    <h2 className="section-heading">Projects proposed</h2>{created.length ? <div className="project-grid">{created.map((p) => <ProjectCard key={p.id} project={p} data={data} />)}</div> : <p className="muted">No visible proposals yet.</p>}
  </>;
}
