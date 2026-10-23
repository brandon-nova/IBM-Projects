import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { settings, request } from "./supabase.mjs";

// Administrator CLI only. GET requests; no emails, account changes, or writes.
async function main() {
  const config = settings();
  try {
    const production = parseEnv(readFileSync(".env.production", "utf8"));
    if (production.NEXT_PUBLIC_SUPABASE_URL && production.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "") !== config.url) {
      console.log("WARNING: .env.local and .env.production point at different Supabase projects. This checks the local configuration.");
    }
  } catch { /* A production env file is optional. */ }
  async function allRows(path) {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
      const page = await request(config, `/rest/v1/${path}&offset=${offset}&limit=100`, undefined, "GET");
      rows.push(...page);
      if (page.length < 100) return rows;
    }
  }
  async function authUsers() {
    const rows = [];
    for (let page = 1; ; page++) {
      const result = await request(config, `/auth/v1/admin/users?page=${page}&per_page=100`, undefined, "GET");
      rows.push(...result.users);
      if (result.users.length < 100) return rows;
    }
  }
  const [profiles, access, roles, projects, members, requests, users] = await Promise.all([
    allRows("profiles?select=user_id,hidden_from_people&order=user_id"),
    allRows("approved_emails?select=user_id,active&order=email"),
    allRows("user_roles?select=user_id,role&order=user_id"),
    allRows("projects?select=id,approval_status,visibility,work_status&order=id"),
    allRows("project_members?select=project_id,user_id,membership_status&order=project_id,user_id"),
    allRows("project_requests?select=project_id,user_id,request_type,status&order=id"),
    authUsers(),
  ]);
  const active = profiles.filter((p) => users.some((u) => u.id === p.user_id) && access.some((a) => a.user_id === p.user_id && a.active));
  const confirmed = (p) => users.some((u) => u.id === p.user_id && u.email_confirmed_at);
  const previous = active.filter((p) => !p.hidden_from_people && confirmed(p));
  console.log(`Auth accounts: ${users.length}. Profiles: ${profiles.length}. Administrators: ${roles.filter((r) => r.role === "admin").length}.`);
  console.log(`Accounts missing profiles: ${users.filter((u) => !profiles.some((p) => p.user_id === u.id)).length}.`);
  console.log(`Profiles without active bound access: ${profiles.length - active.length}.`);
  console.log(`Active profiles: ${active.length}. Unconfirmed: ${active.filter((p) => !confirmed(p)).length}. Hidden from People: ${active.filter((p) => p.hidden_from_people).length}.`);
  console.log(`Previous search could return ${previous.length}; corrected admin search can return ${active.length}. Email confirmation is not required for corrected search.`);
  for (const project of projects) {
    const participates = (p) => members.some((m) => m.project_id === project.id && m.user_id === p.user_id && m.membership_status === "active");
    const invited = (p) => requests.some((r) => r.project_id === project.id && r.user_id === p.user_id && r.request_type === "invitation" && r.status === "pending");
    console.log(`Project ${project.id} (${project.approval_status}, ${project.visibility}, ${project.work_status}): previous available results ${previous.filter((p) => !participates(p) && !invited(p)).length}; corrected results ${active.length} (${active.filter(participates).length} already participating, ${active.filter((p) => !participates(p) && invited(p)).length} invited).`);
  }
  console.log("Read-only diagnosis complete. No emails, account details, credentials, or mutations were emitted. Counts describe stored data, not proof the correction is installed or the live search works.");
}

main().catch((error) => {
  const code = error?.cause?.code;
  const detail = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "EPERM", "EACCES"].includes(code) ? ` (${code})` : "";
  console.error(`Assignment diagnosis failed${detail}. Check .env.local, the service-role key, database migrations, and network access. No data was changed.`);
  process.exitCode = 1;
});
