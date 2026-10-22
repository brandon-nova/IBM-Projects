import Link from "next/link";
import { AuthForm } from "@/components/forms";
import { Brand, Footer } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { supabaseConfig } from "@/lib/config";

const notices: Record<string,string> = {
  access: "Sign in with a verified, approved account to enter the workspace.",
  expired: "We couldn't verify that email link. It may have expired or already been used. Request a fresh email and open the newest link.",
  "email-link": "This email link is incomplete. Request a fresh verification email or password reset below.",
  "email-browser": "We couldn't verify this link. Open the newest email in the same browser that requested it, or request another email.",
  "email-unavailable": "Email verification is temporarily unavailable. Please try again shortly.",
  password: "Password updated. Sign in with your new password.",
};
export default async function Login({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : params.mode === "reset" ? "reset" : params.mode === "verify" ? "verify" : "login";
  const configured = Boolean(supabaseConfig());
  if (!configured && process.env.NODE_ENV === "production") return <div className="auth-page"><header className="auth-header"><Brand /></header><main className="auth-card" id="main"><p className="eyebrow">Find work worth doing</p><h1>Good things are taking shape.</h1><p className="muted">We’re getting this workspace ready. Sign-in will be available soon.</p><Button asChild variant="outline"><Link href="/">Back to homepage</Link></Button></main><Footer /></div>;
  return <div className="auth-page"><header className="auth-header"><Brand /></header><main className="auth-card" id="main">
    <p className="eyebrow">Find work worth doing</p>
    <h1>{mode === "signup" ? "A place for your skills." : mode === "reset" ? "Let’s get you back in." : mode === "verify" ? "A fresh start." : "Welcome back."}</h1>
    <p className="muted">{mode === "signup" ? "Use your @ibm.com address, or an email approved by an administrator. Verify your email to enter the workspace." : mode === "reset" ? "We’ll email you a link to reset your password." : mode === "verify" ? "Request a new email to finish confirming your account." : "Sign in to find your next opportunity."}</p>
    {typeof params.notice === "string" && notices[params.notice] && <p role={params.notice === "password" ? "status" : "alert"} className={`notice ${params.notice === "password" ? "notice-success" : "notice-error"} mb-5`}>{notices[params.notice]}</p>}
    {configured ? <AuthForm mode={mode} /> : <div className="panel stack-sm"><h2>One quick setup first.</h2><p className="muted">Open <code>.env.local</code> in your project folder and add your Supabase URL and publishable key. Restart the app, then sign in.</p><p className="field-hint">The complete walkthrough is in <code>docs/SUPABASE_SETUP.md</code>, including database setup and your first admin account.</p></div>}
    <div className="auth-links"><Link className="text-link" href={mode === "login" ? "/login?mode=signup" : "/login"}>{mode === "login" ? "Create an account" : "Back to sign in"}</Link>{mode === "login" && <Link className="text-link" href="/login?mode=reset">Forgot password?</Link>}{mode !== "verify" && <Link className="text-link" href="/login?mode=verify">Resend verification email</Link>}</div>
  </main><Footer /></div>;
}
