import Link from "next/link";
import { Footer } from "@/components/shell";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { supabaseConfig } from "@/lib/config";
import { readEmailConfirmation } from "@/lib/email-confirmation";
import { EmailConfirmationForm } from "@/components/email-confirmation-form";

export const dynamic = "force-dynamic";

export default async function ConfirmEmail({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const link = readEmailConfirmation(await searchParams);
  const configured = Boolean(supabaseConfig());
  const recovery = link?.kind === "token" && link.type === "recovery";
  return <div className="auth-page">
    <a href="#main" className="skip-link">Skip to content</a>
    <PublicHeader />
    <main className="auth-card" id="main">
      <p className="eyebrow">Your workspace</p>
      <h1>{!configured ? "Sign-in is coming soon." : !link ? "Let’s get you a new link." : recovery ? "Reset your password." : "Let’s get you signed in."}</h1>
      <p className="muted">{!configured ? "We’re getting this workspace ready. Please try again when sign-in is available." : !link ? "This link is incomplete or could not be verified. Request a fresh email and open the newest link." : recovery ? "Continue to choose a new password." : "We’ll verify your email and take you into your workspace automatically."}</p>
      {configured && link ? <EmailConfirmationForm link={link} /> : <Button asChild><Link href={configured ? "/login?mode=verify" : "/"}>{configured ? "Send a new verification email" : "Back to homepage"}</Link></Button>}
      {configured && <div className="auth-links"><Link className="text-link" href="/login">Sign in</Link>{link && <Link className="text-link" href="/login?mode=verify">Request a new verification email</Link>}<Link className="text-link" href="/login?mode=reset">Request a password reset</Link></div>}
    </main>
    <Footer />
  </div>;
}
