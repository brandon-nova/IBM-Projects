import Link from "next/link";
import { Brand, Footer } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { supabaseConfig } from "@/lib/config";
import { readEmailConfirmation } from "@/lib/email-confirmation";
import { confirmEmail } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConfirmEmail({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const link = readEmailConfirmation(await searchParams);
  const configured = Boolean(supabaseConfig());
  const recovery = link?.kind === "token" && link.type === "recovery";
  return <div className="auth-page">
    <a href="#main" className="skip-link">Skip to content</a>
    <header className="auth-header"><Brand /></header>
    <main className="auth-card" id="main">
      <p className="eyebrow">Your workspace</p>
      <h1>{!configured ? "Sign-in is coming soon." : !link ? "Let’s get you a new link." : recovery ? "Reset your password." : link.kind === "code" ? "Continue to your account." : "Confirm your email."}</h1>
      <p className="muted">{!configured ? "We’re getting this workspace ready. Please try again when sign-in is available." : !link ? "This link is incomplete or could not be verified. Request a fresh email and open the newest link." : recovery ? "Continue to choose a new password. Opening this page has not used your link." : "Select the button below to continue securely. Opening this page has not used your link."}</p>
      {configured && link ? <form action={confirmEmail}>
        {link.kind === "token" ? <><input type="hidden" name="token_hash" value={link.tokenHash} /><input type="hidden" name="type" value={link.type} /></> : <input type="hidden" name="code" value={link.code} />}
        <Button type="submit">{recovery ? "Continue to reset password" : link.kind === "code" ? "Continue securely" : "Confirm email"}</Button>
      </form> : <Button asChild><Link href={configured ? "/login?mode=verify" : "/"}>{configured ? "Send a new verification email" : "Back to homepage"}</Link></Button>}
      {configured && <div className="auth-links"><Link className="text-link" href="/login">Back to sign in</Link><Link className="text-link" href="/login?mode=reset">Request a password reset</Link></div>}
    </main>
    <Footer />
  </div>;
}
