import { settings, provision, findUser, request } from "./supabase.mjs";

// This is the explicitly requested account reset, not a general deletion tool.
const administratorEmail = "btongnova@gmail.com";
const testEmail = "nova@ibm.com";

async function main() {
  const config = settings();
  if (new URL(config.url).hostname !== "hatvbfuznerrprpuccpj.supabase.co") throw new Error("This reset is restricted to the requested IBM development workspace.");
  if (process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() !== administratorEmail) throw new Error(`Set BOOTSTRAP_ADMIN_EMAIL=${administratorEmail} first.`);
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password || password.length < 12) throw new Error("Keep a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters configured locally. Existing passwords are preserved.");

  // Provision and verify the replacement administrator before any deletion.
  const admin = await provision(config, administratorEmail, process.env.BOOTSTRAP_ADMIN_NAME || "Workspace admin", password, { admin: true });
  const [account, profiles, roles, access] = await Promise.all([
    findUser(config, administratorEmail),
    request(config, `/rest/v1/profiles?user_id=eq.${encodeURIComponent(admin.id)}&select=user_id`, undefined, "GET"),
    request(config, `/rest/v1/user_roles?user_id=eq.${encodeURIComponent(admin.id)}&select=role`, undefined, "GET"),
    request(config, `/rest/v1/approved_emails?email=eq.${encodeURIComponent(administratorEmail)}&select=user_id,active`, undefined, "GET"),
  ]);
  if (!account?.email_confirmed_at || account.id !== admin.id || !profiles.length || roles[0]?.role !== "admin" || !access[0]?.active || access[0]?.user_id !== admin.id) {
    throw new Error("The personal administrator is not ready. The IBM account was not deleted.");
  }
  console.log(`Personal administrator ready: ${administratorEmail} — confirmed email, profile, admin role, and active workspace access.`);

  const target = await findUser(config, testEmail);
  if (!target) { console.log("IBM test login is already absent. Check approved access before signing up again to test verification."); return; }
  if (target.id === admin.id || target.email?.toLowerCase() !== testEmail) throw new Error("Account identity mismatch. Reset stopped.");
  const uid = encodeURIComponent(target.id);
  const relationships = [
    ["projects", `or=(creator_id.eq.${uid},owner_id.eq.${uid},completed_by.eq.${uid})`],
    ["project_members", `user_id=eq.${uid}`],
    ["project_requests", `or=(user_id.eq.${uid},reviewed_by.eq.${uid})`],
    ["project_deliverables", `or=(contributor_id.eq.${uid},reviewed_by.eq.${uid})`],
  ];
  const linked = await Promise.all(relationships.map(async ([table, filter]) => {
    const rows = await request(config, `/rest/v1/${table}?${filter}&limit=1`, undefined, "GET");
    return rows.length ? table : null;
  }));
  if (linked.some(Boolean)) throw new Error(`The IBM test account has linked work (${linked.filter(Boolean).join(", ")}). Reset stopped; no projects, memberships, requests, or evidence were deleted.`);

  // Foreign keys also prevent deletion if linked work is added after the checks.
  // Auth deletion cascades only the profile, skills, role, and availability here.
  // Keep the allowlist row so an existing revocation is never silently removed.
  console.log(`Removing only the test login: ${testEmail}.`);
  await request(config, `/auth/v1/admin/users/${uid}`, undefined, "DELETE");
  const [remaining, profile, approval] = await Promise.all([
    findUser(config, testEmail),
    request(config, `/rest/v1/profiles?user_id=eq.${uid}&select=user_id`, undefined, "GET"),
    request(config, `/rest/v1/approved_emails?email=eq.${encodeURIComponent(testEmail)}&select=user_id,active`, undefined, "GET"),
  ]);
  if (remaining || profile.length || approval.some((row) => row.user_id === target.id)) throw new Error("Deletion was requested but final checks were incomplete. Run npm run auth:inspect before trying again.");
  console.log("IBM test login and app profile removed. Personal administrator retained. The allowlist entry remains unbound; explicit revocations are preserved.");
  if (approval.some((row) => !row.active)) {
    console.log("The test address is explicitly revoked. Restore it through administrator access controls before a new signup.");
    return;
  }
  console.log("Sign out of old sessions. Open https://projects.fncai.org/login?mode=signup in a private window and create nova@ibm.com again. Do not bootstrap that address; normal signup tests real email verification.");
}

main().catch((error) => {
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "EPERM", "EACCES"].includes(error?.cause?.code)) {
    console.error(`Account reset stopped: Supabase connection failed (${error.cause.code}). Rerun from a terminal with network access; the command is safe to retry.`);
  } else {
    console.error(`Account reset stopped: ${error.message}`);
  }
  process.exitCode = 1;
});
