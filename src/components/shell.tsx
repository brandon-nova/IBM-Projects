import Link from "next/link";
import { ArrowUpRight, Layers2, LogOut } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/domain";
import { logout } from "@/app/actions";
import { Button } from "./ui/button";

export function Brand() {
  return <Link href="/" className="brand" aria-label="Soverflow home"><span className="brand-symbol"><Layers2 size={20} strokeWidth={2} /></span>Soverflow<span className="brand-dot">.</span></Link>;
}
export function Footer() {
  return <footer className="site-footer"><span>Find work worth doing.</span><span>IBM-named demo · Fictional people and projects · Independently built; no IBM endorsement.</span></footer>;
}
export async function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) return children;
  const client = await createClient();
  const { count, error } = await client.from("project_members").select("*", { count: "exact", head: true }).eq("user_id", viewer.id).eq("membership_status", "active");
  if (error) throw new Error("Could not load your navigation.");
  const links = count ? [["/", "Home"], ["/projects", "Projects"], ["/people", "People"], ["/learning", "Learning"], [`/people/${viewer.id}`, "Profile"]] : [["/projects", "Projects"], ["/people", "People"]];
  return <div className="app-frame">
    <a href="#main" className="skip-link">Skip to content</a>
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">{links.map(([href, text]) => <Link href={href} key={text}>{text}</Link>)}{viewer.role === "admin" && <Link href="/admin">Admin</Link>}</nav>
      <div className="header-account"><Link className="avatar" href={`/people/${viewer.id}`} aria-label={`Your profile: ${viewer.profile.display_name}`}>{initials(viewer.profile.display_name)}</Link><form action={logout}><Button variant="ghost" size="sm" aria-label="Sign out"><LogOut size={16} /></Button></form></div>
    </header>
    <main id="main" className="main-content">{children}</main>
    <Footer />
  </div>;
}
export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted page-description">{description}</p>}</div>{action}</div>;
}
export function EmptyState({ title, description, href = "/projects", label = "Browse projects" }: { title: string; description?: string; href?: string; label?: string }) {
  return <div className="empty-state"><h2>{title}</h2>{description && <p className="muted">{description}</p>}<Button asChild variant="outline"><Link href={href}>{label}<ArrowUpRight size={15} /></Link></Button></div>;
}
