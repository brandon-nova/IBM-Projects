import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { settings, findUser, request } from "./supabase.mjs";

// Local administrator diagnostic only. GET requests; no emails or mutations.
async function main() {
  const config = settings();
  let email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    const prompt = createInterface({ input: stdin, output: stdout });
    try { email = (await prompt.question("Email address to check: ")).trim().toLowerCase(); }
    finally { prompt.close(); }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const user = await findUser(config, email);
  if (!user) {
    console.log("Auth account: not found in the configured Supabase project.");
    console.log("Resend cannot create an account. Use Create an account first, then check Supabase Auth logs if signup fails.");
    return;
  }
  const confirmed = Boolean(user.email_confirmed_at);
  console.log(`Auth account: exists. Email: ${confirmed ? "already confirmed" : "not confirmed"}.`);
  if (user.confirmation_sent_at) console.log(`Last confirmation request recorded by Supabase: ${user.confirmation_sent_at}. This does not prove email delivery.`);
  const checks = [
    ["App profile", `/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`],
    ["Workspace access", `/rest/v1/approved_emails?email=eq.${encodeURIComponent(email)}&select=user_id,active`],
  ];
  const results = await Promise.allSettled(checks.map(([, path]) => request(config, path, undefined, "GET")));
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status === "rejected") {
      console.log(`${checks[index][0]}: could not check. Confirm the database schema and service-role key.`);
      process.exitCode = 1;
    } else if (index === 0) {
      console.log(`App profile: ${result.value.length ? "present" : "missing; administrator investigation required"}.`);
    } else {
      const access = result.value[0];
      console.log(`Workspace access: ${access?.active && access.user_id === user.id ? "active and bound to this account" : "missing, revoked, or not bound; administrator investigation required"}.`);
    }
  }
  console.log(confirmed
    ? "Verification resend does not send a new confirmation for this account. Sign in, or use Forgot password if needed."
    : "Request verification once, then inspect Resend → Emails. No message there? Check Supabase Logs → Auth for that attempt.");
}
main().catch((error) => {
  const code = error?.cause?.code;
  const detail = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "EPERM", "EACCES"].includes(code) ? ` (${code})` : "";
  // Avoid printing provider errors which may contain personal data.
  console.error(`Account check failed${detail}. Check .env.local, service-role access, and network connectivity. No account was changed and no email was requested.`);
  process.exitCode = 1;
});
