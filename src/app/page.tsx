import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Compass, FolderKanban, Lightbulb, Plus, Sparkles, UserRound } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { loadWorkspace } from "@/lib/data";
import { Brand, Footer, WorkspaceShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { InterestSearch } from "@/components/forms";

export const dynamic = "force-dynamic";

function OpportunityIllustration() {
  return <figure className="opportunity-illustration" aria-label="Your skills and curiosity connect to meaningful work">
    <div className="illustration-orbit orbit-outer" aria-hidden="true" />
    <div className="illustration-orbit orbit-inner" aria-hidden="true" />
    <span className="illustration-label">A little curiosity goes a long way.</span>
    <div className="illustration-skills">
      <span className="illustration-card-label"><span className="blue-dot" />You bring</span>
      <div className="illustration-tags"><span>Skills</span><span>Fresh ideas</span><span>Curiosity</span></div>
    </div>
    <div className="illustration-arrow" aria-hidden="true"><ArrowUpRight strokeWidth={1.2} /></div>
    <div className="illustration-result">
      <span className="illustration-result-icon" aria-hidden="true"><Sparkles size={22} strokeWidth={1.5} /></span>
      <div><span className="illustration-card-label">Together, we build</span><p>Something that matters.</p></div>
    </div>
    <figcaption>Different skills. Shared possibilities.</figcaption>
  </figure>;
}

const steps = [
  { number: "01", icon: Compass, title: "Find your spark.", text: "Discover a project that needs your skills, or one that helps you learn something new." },
  { number: "02", icon: UserRound, title: "Connect with people.", text: "Meet the owner, join the team, and turn a shared idea into a clear next step." },
  { number: "03", icon: ArrowUpRight, title: "Make a difference.", text: "Contribute something useful and keep a record of the work you helped bring to life." },
];

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) return <div className="app-frame public-home">
    <a href="#main" className="skip-link">Skip to content</a>
    <header className="site-header public-header">
      <Brand />
      <div className="public-header-actions"><span>Your next opportunity starts here.</span><Button asChild size="sm"><Link href="/login">Sign in<ArrowRight size={15} /></Link></Button></div>
    </header>
    <main id="main" className="main-content landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow"><span className="blue-dot" />Built on curiosity. Made for you.</p>
          <h1 id="landing-title">Find work<br /><span>worth doing.</span></h1>
          <p className="landing-description">You have something to bring. Find a project that needs it.</p>
          <p className="landing-detail">Explore opportunities, connect with people, and put your skills to work on something that matters.</p>
          <div className="landing-actions"><Button asChild size="lg"><Link href="/projects">Explore opportunities<ArrowRight size={17} /></Link></Button><Link className="landing-secondary" href="/projects/new">Propose a project<Plus size={16} /></Link></div>
          <p className="landing-note">Small projects. New connections. Real contributions.</p>
        </div>
        <OpportunityIllustration />
      </section>
      <section className="landing-process" aria-labelledby="process-title">
        <div className="process-heading"><p className="eyebrow">Room to do something good</p><h2 id="process-title">A small start.<br />A meaningful contribution.</h2></div>
        <div className="landing-steps">{steps.map((step) => <article className="landing-step" key={step.number}>
          <div className="step-top"><span>{step.number}</span><step.icon size={21} strokeWidth={1.5} aria-hidden="true" /></div><h3>{step.title}</h3><p>{step.text}</p>
        </article>)}</div>
      </section>
    </main>
    <Footer />
  </div>;

  const data = await loadWorkspace();
  const joined = data.members.filter((m) => m.user_id === viewer.id && m.membership_status === "active");
  return <WorkspaceShell>{joined.length === 0 ? <section className="welcome">
    <div className="welcome-icon" aria-hidden="true"><Compass size={28} strokeWidth={1.5} /></div>
    <p className="eyebrow">Your next opportunity</p>
    <h1>What do you want to<br /><span>learn or work on?</span></h1>
    <p className="welcome-subtitle">Bring a skill. Follow an interest.<br />There’s a good place to start.</p>
    <InterestSearch />
    <div className="welcome-divider">or make your own way</div>
    <div className="welcome-actions">
      <Link href="/projects" className="welcome-action" aria-label="Browse projects"><span className="welcome-action-icon"><FolderKanban size={21} strokeWidth={1.5} /></span><span><strong>Browse projects</strong><small>See where you can make a difference.</small></span><ArrowUpRight size={18} /></Link>
      <Link href="/projects/new" className="welcome-action" aria-label="Create a project"><span className="welcome-action-icon"><Lightbulb size={21} strokeWidth={1.5} /></span><span><strong>Create a project</strong><small>Give a good idea somewhere to grow.</small></span><ArrowUpRight size={18} /></Link>
    </div>
  </section> : <>
    <section className="dashboard-intro">
      <div><p className="eyebrow">Your workspace. Your possibilities.</p><h1>Hello, {viewer.profile.display_name.split(" ")[0]}.</h1><p>A good day to learn something. A good place to make it happen.</p></div>
      <div className="dashboard-intro-art" aria-hidden="true"><ArrowUpRight strokeWidth={1} /></div>
    </section>
    <div className="home-cards">{[
      { href: `/people/${viewer.id}`, icon: UserRound, title: "Profile", number: "01", text: "The skills you bring. The things you want to learn. The work you’re proud of.", action: "Make it yours", featured: false },
      { href: "/learning", icon: BookOpen, title: "Learning", number: "02", text: "Follow your curiosity. Find a project that gives a new skill room to grow.", action: "Find your next skill", featured: false },
      { href: "/projects", icon: FolderKanban, title: "Projects", number: "03", text: "A small project could use your perspective. Find something worth getting into.", action: "Explore opportunities", featured: true },
    ].map((card) => <Link href={card.href} key={card.title} className={`home-card${card.featured ? " home-card-featured" : ""}`}>
      <div className="home-card-top"><span className="home-card-icon"><card.icon size={26} strokeWidth={1.5} /></span><span className="home-card-number">{card.number}</span></div><h2>{card.title}</h2><p>{card.text}</p><span className="home-card-footer">{card.action}<ArrowUpRight size={19} /></span>
    </Link>)}</div>
    <div className="dashboard-bottom"><span>Something on your mind? Make it a project.</span><Link href="/projects/new">Propose an idea<Plus size={16} /></Link><Link href="/projects?my=1">Your projects<ArrowRight size={16} /></Link></div>
  </>}</WorkspaceShell>;
}
