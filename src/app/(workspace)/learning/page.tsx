import Link from "next/link";
import { loadWorkspace, personTags, projectTags } from "@/lib/data";
import { PageTitle, EmptyState } from "@/components/shell";
import { ProjectCard, SkillTags } from "@/components/projects";
import { Button } from "@/components/ui/button";

export default async function Learning() {
  const data = await loadWorkspace();
  const skills = personTags(data,data.viewer.id,"learning");
  const ids = new Set(skills.map((s) => s.id));
  const joined = new Set(data.members.filter((m) => m.user_id === data.viewer.id && m.membership_status === "active").map((m) => m.project_id));
  const matches = data.projects.filter((p) => p.work_status !== "completed" && !joined.has(p.id) && projectTags(data,p.id).some((s) => ids.has(s.id)));
  return <><PageTitle eyebrow="Learn by doing" title="Make room to grow." description="Practice a skill by contributing to something useful." action={<Button asChild variant="outline"><Link href={`/people/${data.viewer.id}?edit=1`}>Edit interests</Link></Button>} />
    {skills.length > 0 && <div className="mb-8"><p className="meta-label">Skills you want to learn</p><SkillTags skills={skills} /></div>}
    {matches.length ? <div className="project-grid">{matches.map((p) => <ProjectCard key={p.id} project={p} data={data} />)}</div> : <EmptyState title={skills.length ? "No matching opportunities yet." : "What would you like to learn?"} description={skills.length ? "Try another interest, or see what else is open." : "Add a few interests to your profile to find projects involving those skills."} href={skills.length ? "/projects" : `/people/${data.viewer.id}?edit=1`} label={skills.length ? "Browse projects" : "Add learning interests"} />}
  </>;
}
