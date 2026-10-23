import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Clock3, Code2, Database, FolderKanban, Palette, Search, UserRound } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { loadWorkspace } from "@/lib/data";
import { Footer, WorkspaceShell } from "@/components/shell";
import { PublicHeader } from "@/components/public-header";
import { SuggestedProjects } from "@/components/suggested-projects";
import { Button } from "@/components/ui/button";
import { InterestSearch } from "@/components/forms";

export const dynamic = "force-dynamic";

// Public examples are static fictional content, never workspace records.
const examples = [
  { title: "Automate a weekly report", text: "Replace a repetitive spreadsheet with a simple script.", skills: ["Python", "Automation"], hours: "4–6 hours", icon: Code2 },
  { title: "Make a guide easier to use", text: "Help coworkers find the answers they need.", skills: ["Design", "Documentation"], hours: "2–4 hours", icon: Palette },
  { title: "Explore a sample dataset", text: "Find a useful pattern and share what you learn.", skills: ["SQL", "Data engineering"], hours: "3–5 hours", icon: Database },
];

function DiscoveryPreview() {
  return <section className="discovery-preview" aria-labelledby="preview-title">
    <div className="preview-toolbar"><h2 id="preview-title"><FolderKanban size={18} strokeWidth={1.6} aria-hidden="true" />Projects</h2><span className="preview-caption">Fictional examples</span></div>
    <div className="preview-content">
      <form action="/projects" method="get" className="preview-search" role="search">
        <Search size={18} aria-hidden="true" /><label htmlFor="preview-query" className="sr-only">Search projects by skill or interest</label>
        <input id="preview-query" name="q" type="search" placeholder="Search by skill or interest…" maxLength={80} />
        <Button type="submit" variant="ghost" size="sm" aria-label="Search projects"><ArrowRight size={17} aria-hidden="true" /></Button>
      </form>
      <div className="preview-grid">{examples.map((example) => <Link className="preview-card" href={`/projects?q=${encodeURIComponent(example.skills[0])}`} key={example.title} aria-label={`Explore ${example.skills[0]} projects`}>
        <div className="preview-card-top"><span className="preview-topic-icon"><example.icon size={21} strokeWidth={1.5} aria-hidden="true" /></span><span className="preview-status">Open</span></div>
        <h3>{example.title}</h3><p>{example.text}</p>
        <div className="tags">{example.skills.map((skill) => <span className="skill" key={skill}>{skill}</span>)}</div>
        <div className="preview-card-bottom"><span><Clock3 size={14} aria-hidden="true" />{example.hours}</span><ArrowUpRight size={17} aria-hidden="true" /></div>
      </Link>)}</div>
    </div>
  </section>;
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const viewer = await getViewer();
  if (!viewer) return <div className="app-frame public-home">
    <a href="#main" className="skip-link">Skip to content</a>
    <PublicHeader />
    <main id="main" className="main-content landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <h1 id="landing-title">Find work <span>worth doing.</span></h1>
        <p className="landing-description">Discover internal projects. Build skills. Make an impact.</p>
        <div className="landing-actions"><Button asChild size="lg"><Link href="/projects">Explore projects<ArrowRight size={17} aria-hidden="true" /></Link></Button><Button asChild size="lg" variant="outline"><Link href="/projects/new">Post a project</Link></Button></div>
      </section>
      <DiscoveryPreview />
    </main><Footer />
  </div>;

  const data = await loadWorkspace();
  const joined = data.members.filter((m) => m.user_id === viewer.id && m.membership_status === "active");
  return <WorkspaceShell>{params.notice === "email-verified" && <p role="status" className="notice notice-success mb-6">Success! Email verified.</p>}{joined.length === 0 ? <section className="welcome" aria-labelledby="welcome-title">
    <h1 id="welcome-title">What do you want to work on?</h1>
    <InterestSearch />
    <div className="welcome-actions"><Link href="/projects">Browse projects<ArrowUpRight size={15} aria-hidden="true" /></Link><Link href="/projects/new">Create a project<ArrowUpRight size={15} aria-hidden="true" /></Link></div>
  </section> : <section className="participant-home" aria-labelledby="participant-title">
    <h1 id="participant-title">What’s next for you?</h1>
    <div className="home-cards">{[
      { href: `/people/${viewer.id}`, icon: UserRound, title: "Profile", text: "Your skills and contributions" },
      { href: "/learning", icon: BookOpen, title: "Learning", text: "Grow your skills" },
      { href: "/projects", icon: FolderKanban, title: "Projects", text: "Find and manage opportunities" },
    ].map((card) => <Link href={card.href} key={card.title} className="home-card"><card.icon className="home-card-icon" size={30} strokeWidth={1.5} aria-hidden="true" /><div><h2>{card.title}</h2><p>{card.text}</p></div><ArrowUpRight className="home-card-arrow" size={21} aria-hidden="true" /></Link>)}</div>
  </section>}<SuggestedProjects data={data} /></WorkspaceShell>;
}
