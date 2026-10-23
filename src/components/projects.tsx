import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { labels } from "@/lib/domain";
import { personName, projectTags, type WorkspaceData } from "@/lib/data";
import type { Project } from "@/lib/database.types";
import { Badge } from "./ui/badge";

export function SkillTags({ skills, people = false }: { skills: { id: string; name: string }[]; people?: boolean }) {
  return <div className="tags">{skills.map((s) => <Link key={s.id} className="skill" href={`${people ? "/people" : "/projects"}?skill=${encodeURIComponent(s.name)}`}>{s.name}</Link>)}</div>;
}
export function ProjectCard({ project, data, verified = false }: { project: Project; data: WorkspaceData; verified?: boolean }) {
  return <article className="project-card">
    <div className="card-top"><Badge tone={project.work_status === "completed" ? "blue" : "neutral"}>{labels[project.work_status]}</Badge>{project.visibility === "private" && <span className="private-label"><LockKeyhole size={12} />Private</span>}{verified && <span className="verified-label"><CheckCircle2 size={14} />Verified</span>}</div>
    <div className="project-card-copy"><h2><Link href={`/projects/${project.id}`}>{project.title}</Link></h2>
    <p className="muted line-clamp-3">{project.description}</p></div>
    <SkillTags skills={projectTags(data, project.id)} />
    <div className="project-card-bottom"><span className="muted text-xs">{personName(data, project.owner_id)}</span>{project.estimated_hours && <span className="effort"><Clock3 size={13} />{project.estimated_hours}h / week</span>}<Link href={`/projects/${project.id}`} className="card-arrow" aria-label={`View ${project.title}`}><ArrowUpRight size={19} /></Link></div>
  </article>;
}
