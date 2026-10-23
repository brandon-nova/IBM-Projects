import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { cloudflareSettings } from "./cloudflare-settings.mjs";

// Read-only: no account creation, email sending, or privileged keys.
async function main() {
  if (!existsSync('.env.production')) throw new Error('Create .env.production first. See docs/EMAIL_SETUP.md.');
  const production = parseEnv(readFileSync('.env.production', 'utf8'));
  const settings = cloudflareSettings(production);
  if (!settings.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Production is a homepage-only preview. Set both public Supabase values and redeploy.');
  console.log('Production public configuration: valid. No keys are printed.');
  if (existsSync('.env.local')) {
    const local = parseEnv(readFileSync('.env.local', 'utf8'));
    if (local.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== settings.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Local and production point to different Supabase projects. Check which database you installed.');
    console.log('Local and production Supabase project URLs match.');
  }
  const results = await Promise.allSettled([
    (async () => {
      const response = await fetch(`${settings.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Supabase Auth settings returned HTTP ${response.status}. Check the public URL/key pair and provider status.`);
      const data = await response.json();
      console.log(`Supabase Auth reachable. Email login enabled: ${data.external?.email === true}. Signup disabled: ${data.disable_signup === true}. Email auto-confirm: ${data.mailer_autoconfirm === true}.`);
      if (data.disable_signup === true || data.external?.email === false || data.mailer_autoconfirm === true) throw new Error('Review Authentication → Sign In / Providers. Email signup must be enabled and Confirm email must stay enabled.');
    })(),
    (async () => {
      const response = await fetch(`${settings.NEXT_PUBLIC_APP_URL}/login?mode=signup`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Live signup page returned HTTP ${response.status}. Check the Cloudflare deployment.`);
      const html = await response.text();
      if (!html.includes('name="display_name"') || !html.includes('Create account')) throw new Error('The live signup form is not available. Deploy the configured app with npm run cf:deploy.');
      console.log('Live signup form is available.');
    })(),
  ]);
  for (const result of results) if (result.status === 'rejected') {
    const cause = result.reason?.cause?.code;
    const networkCode = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'EPERM', 'EACCES'].includes(cause) ? ` (${cause})` : '';
    console.error(`Check failed: ${result.reason?.message ?? 'Request failed'}${networkCode}`);
    process.exitCode = 1;
  }
  console.log('This does not test SMTP credentials, email delivery, database triggers, or completed signup. Follow docs/AUTH_DEBUGGING.md for the real email test.');
}
main().catch((error) => { console.error(`Auth check failed: ${error.message}`); process.exitCode = 1; });
