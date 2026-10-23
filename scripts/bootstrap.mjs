import { settings, provision } from "./supabase.mjs";
const config = settings();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.");
await provision(config, email, process.env.BOOTSTRAP_ADMIN_NAME || "Workspace admin", password, { admin: true });
console.log("Administrator provisioned: profile, access binding, and admin role are ready. Existing passwords and profile details are preserved.");
