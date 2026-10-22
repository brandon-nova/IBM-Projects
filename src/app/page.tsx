import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, FolderKanban, Plus, UserRound } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { loadWorkspace } from "@/lib/data";
import { Brand, Footer, PageTitle, WorkspaceShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { InterestSearch } from "@/components/forms";

export const dynamic = "force-dynamic";
export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) return <div className="app-frame">
    <header className="site-header"><Brand /><div className="ml-auto"><Button asChild variant="outline"><Link href="/login">Sign in<ArrowUpRight size={15} /></Link></Button></div></header>
    <main id="main" className="main-content"><div className="landing">
      <p className="eyebrow">Small projects. Meaningful contributions.</p>
      <h1>Find work<br /><span>worth doing.</span></h1>
      <p>Bring a skill. Follow your curiosity. Find a small project where you can make a useful difference.</p>
      <Button asChild size="lg"><Link href="/login">Find your next opportunity<ArrowRight size={16} /></Link></Button>
      <div className="landing-steps">{[["01", "Find your opportunity", "Discover projects that need your skills—or the ones you want to learn."], ["02", "Make something useful", "Connect with an owner, join a small team, and contribute real work."], ["03", "Show what you accomplished", "Get your contribution confirmed and keep a record of work that mattered."]].map(([n,title,text]) => <div key={n} className="landing-step"><span>{n}</span><h2>{title}</h2><p>{text}</p></div>)}</div>
    </div></main><Footer />
  </div>;
  const data = await loadWorkspace();
  const joined = data.members.filter((m) => m.user_id === viewer.id && m.membership_status === "active");
  return <WorkspaceShell>{joined.length === 0 ? <section className="welcome">
    <p className="eyebrow">A little curiosity can go a long way</p>
    <h1>What do you want to<br />learn or work on?</h1>
    <p className="muted welcome-subtitle">Find a project that could use your skills.<br />Or discover something you’d like to learn.</p>
    <InterestSearch />
    <div className="welcome-divider">or start here</div>
    <div className="welcome-actions"><Button asChild variant="outline"><Link href="/projects">Browse projects<ArrowUpRight size={15} /></Link></Button><Button asChild variant="ghost"><Link href="/projects/new"><Plus size={16} />Create a project</Link></Button></div>
  </section> : <>
    <PageTitle eyebrow="Your workspace" title={`Hello, ${viewer.profile.display_name.split(" ")[0]}.`} description="A good place to put your skills to work." />
    <div className="home-cards">{[
      { href: `/people/${viewer.id}`, icon: UserRound, title: "Profile", text: "Your skills, your interests, and the work you’ve contributed.", action: "Make it yours" },
      { href: "/learning", icon: BookOpen, title: "Learning", text: "Find opportunities to practice something you want to learn.", action: "Follow your curiosity" },
      { href: "/projects", icon: FolderKanban, title: "Projects", text: "Find something useful to work on. Or put your own idea out there.", action: "Explore projects" },
    ].map((card) => <Link href={card.href} key={card.title} className="home-card"><span className="home-card-icon"><card.icon size={23} /></span><h2>{card.title}</h2><p>{card.text}</p><span className="home-card-footer">{card.action}<ArrowRight size={14} /></span></Link>)}</div>
    <div className="mt-8 flex flex-wrap gap-5 text-sm"><Link className="text-link" href="/projects?my=1">View your projects</Link><Link className="text-link" href="/projects/new">Propose an idea</Link></div>
  </>}</WorkspaceShell>;
}
