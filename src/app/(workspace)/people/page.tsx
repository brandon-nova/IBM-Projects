import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { loadWorkspace, personTags } from "@/lib/data";
import { initials } from "@/lib/domain";
import { PageTitle, EmptyState } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SkillTags } from "@/components/projects";

export default async function People({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const data = await loadWorkspace();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0,100) : "";
  const skill = typeof params.skill === "string" ? params.skill : "";
  const learning = typeof params.learning === "string" ? params.learning : "";
  const hours = typeof params.hours === "string" ? params.hours : "";
  const people = data.profiles.filter((p) => (!q || p.display_name.toLowerCase().includes(q.toLowerCase()))
    && (!skill || personTags(data,p.user_id,"existing").some((s) => s.name === skill))
    && (!learning || personTags(data,p.user_id,"learning").some((s) => s.name === learning))
    && (!hours || (data.availability.find((a) => a.user_id === p.user_id)?.available_hours ?? 0) >= Number(hours)));
  return <><PageTitle eyebrow="Good work starts with people" title="Find your people." description="A skill you need. A shared interest. Someone to build with." />
    <form className="filter-bar" role="search"><div className="filter-search"><label className="sr-only" htmlFor="people-q">Search by name</label><Input id="people-q" name="q" placeholder="Search people by name…" defaultValue={q} maxLength={100} /></div>
      <label htmlFor="people-skill" className="sr-only">Existing skill</label><select id="people-skill" className="field-input" name="skill" defaultValue={skill}><option value="">Existing skills</option>{data.skills.map((s) => <option key={s.id}>{s.name}</option>)}</select>
      <label htmlFor="people-learning" className="sr-only">Desired skill</label><select id="people-learning" className="field-input" name="learning" defaultValue={learning}><option value="">Wants to learn</option>{data.skills.map((s) => <option key={s.id}>{s.name}</option>)}</select>
      <label htmlFor="people-hours" className="sr-only">Availability</label><select id="people-hours" name="hours" className="field-input" defaultValue={hours}><option value="">Any availability</option><option value="1">1+ hours/week</option><option value="5">5+ hours/week</option><option value="10">10+ hours/week</option></select>
      <Button type="submit" variant="outline"><Search size={15} />Search</Button>
    </form>
    <p className="result-count">{people.length} {people.length === 1 ? "person" : "people"}</p>
    {people.length ? <div className="project-grid">{people.map((p) => <article className="project-card" key={p.user_id}><div className="person-row"><span className="avatar">{initials(p.display_name)}</span><h2><Link href={`/people/${p.user_id}`}>{p.display_name}</Link></h2></div><p className="muted">{p.bio || "Ready to find work worth doing."}</p><SkillTags skills={personTags(data,p.user_id,"existing")} people />{personTags(data,p.user_id,"learning").length > 0 && <div><p className="meta-label">Wants to learn</p><div className="tags">{personTags(data,p.user_id,"learning").map((s) => <Link key={s.id} className="skill" href={`/people?learning=${encodeURIComponent(s.name)}`}>{s.name}</Link>)}</div></div>}<Link className="text-xs text-primary inline-flex items-center gap-1 mt-auto" href={`/people/${p.user_id}`}>View profile<ArrowUpRight size={13} /></Link></article>)}</div> : <EmptyState title="No people match these filters." href="/people" label="See everyone" />}
  </>;
}
