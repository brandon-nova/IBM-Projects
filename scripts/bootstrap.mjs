import { settings, provision, request } from "./supabase.mjs";
const config = settings();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.");
const user = await provision(config, email, process.env.BOOTSTRAP_ADMIN_NAME || "Workspace admin", password);
await request(config, `/rest/v1/user_roles?user_id=eq.${user.id}`, { role: "admin" }, "PATCH");
console.log("Administrator provisioned. The supplied password is only applied when creating a new account; existing passwords are preserved.");
