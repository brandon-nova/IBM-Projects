import Link from "next/link";
import { AuthForm } from "@/components/forms";
import { Brand, Footer } from "@/components/shell";
import { supabaseConfig } from "@/lib/config";

const notices: Record<string,string> = { access: "Sign in with an approved account to enter the workspace.", expired: "That email link is invalid or has expired. Request another link.", password: "Password updated. Sign in with your new password." };
export default async function Login({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : params.mode === "reset" ? "reset" : "login";
  const configured = Boolean(supabaseConfig());
  return <div className="auth-page"><header className="auth-header"><Brand /></header><main className="auth-card" id="main">
    <p className="eyebrow">Find work worth doing</p>
    <h1>{mode === "signup" ? "A place for your skills." : mode === "reset" ? "Let’s get you back in." : "Welcome back."}</h1>
    <p className="muted">{mode === "signup" ? "Use the email approved by your workspace administrator." : mode === "reset" ? "We’ll email you a link to reset your password." : "Sign in to find your next opportunity."}</p>
    {typeof params.notice === "string" && notices[params.notice] && <p role="status" className="notice notice-success mb-5">{notices[params.notice]}</p>}
    {configured ? <AuthForm mode={mode} /> : <div className="panel stack-sm"><h2>Workspace setup needed</h2><p className="muted">Set the Supabase URL and publishable key, apply the database migration, and bootstrap an administrator. Setup steps are in the repository README.</p></div>}
    <div className="auth-links"><Link className="text-link" href={mode === "login" ? "/login?mode=signup" : "/login"}>{mode === "login" ? "Create an approved account" : "Back to sign in"}</Link>{mode === "login" && <Link className="text-link" href="/login?mode=reset">Forgot password?</Link>}</div>
  </main><Footer /></div>;
}
