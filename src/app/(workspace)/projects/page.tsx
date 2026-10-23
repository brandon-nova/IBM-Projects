import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { loadWorkspace, personTags, projectTags } from "@/lib/data";
import { PageTitle, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectCard } from "@/components/projects";
import { projectViewUrl } from "@/lib/project-filters";

export default async function Projects({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const data = await loadWorkspace();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0,100) : "";
  const skill = typeof params.skill === "string" ? params.skill : "";
  const status = typeof params.status === "string" ? params.status : "";
  const mine = params.my === "1";
  const learning = params.learn === "1";
  const ownMemberships = new Set(data.members.filter((m) => m.user_id === data.viewer.id && m.membership_status === "active").map((m) => m.project_id));
  const interests = new Set(personTags(data,data.viewer.id,"learning").map((s) => s.id));
  const projects = data.projects.filter((p) => {
    const tags = projectTags(data, p.id);
    const text = [p.title,p.description,...tags.map((s) => s.name)].join(" ").toLowerCase();
    return (!q || text.includes(q.toLowerCase())) && (!skill || tags.some((s) => s.name.toLowerCase() === skill.toLowerCase()))
      && (!status || p.work_status === status) && (!mine || ownMemberships.has(p.id) || p.creator_id === data.viewer.id)
      && (!learning || (tags.some((s) => interests.has(s.id)) && !ownMemberships.has(p.id) && p.work_status !== "completed"));
  });
  return <>
    <PageTitle eyebrow="Find your next opportunity" title={mine ? "Your projects" : learning ? "Projects to learn from" : "Work worth doing."} description={learning ? "Opportunities involving skills you want to practice." : "Small projects. Useful outcomes. A place for your skills."} action={<div className="project-actions"><Button asChild variant="outline"><Link href={projectViewUrl(params,!mine)}>{mine ? "All projects" : "My projects"}</Link></Button><Button asChild><Link href="/projects/new"><Plus size={16} />Create a project</Link></Button></div>} />
    <form className="filter-bar" role="search"><div className="filter-search"><label className="sr-only" htmlFor="project-search">Search projects</label><Input id="project-search" name="q" defaultValue={q} placeholder="Search projects or skills…" maxLength={100} /></div>
      <label className="sr-only" htmlFor="skill-filter">Skill</label><select className="field-input" id="skill-filter" name="skill" defaultValue={skill}><option value="">All skills</option>{data.skills.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
      <label className="sr-only" htmlFor="status-filter">Work status</label><select className="field-input" id="status-filter" name="status" defaultValue={status}><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
      {mine && <input type="hidden" name="my" value="1" />}{learning && <input type="hidden" name="learn" value="1" />}
      <Button type="submit" variant="outline" aria-label="Search projects"><Search size={15} />Search</Button><Button asChild variant="ghost"><Link href={projectViewUrl(params,mine,true)}>Clear filters</Link></Button>
    </form>
    <p className="result-count">{projects.length} {projects.length === 1 ? "opportunity" : "opportunities"}{learning && <> · <Link className="text-link" href={`/people/${data.viewer.id}?edit=1`}>Edit learning interests</Link></>}</p>
    {projects.length ? <div className="project-grid">{projects.map((p) => <ProjectCard key={p.id} project={p} data={data} />)}</div> : <EmptyState title="Nothing matches. Try another skill." description={learning && interests.size === 0 ? "Add skills you want to learn to your profile, or browse every project." : "There may be something interesting just outside your search."} />}
  </>;
}
