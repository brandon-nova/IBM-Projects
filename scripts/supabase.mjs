export function settings() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !service || !key) throw new Error("Set the Supabase URL, publishable key, and server-only service-role key in .env.local.");
  return { url: url.replace(/\/$/, ""), service, key };
}
export async function request(config, path, body, method = "POST", token = config.service) {
  const response = await fetch(`${config.url}${path}`, {
    method, headers: { apikey: config.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} failed (${response.status}): ${data?.message ?? data?.msg ?? data?.error_description ?? "Check configuration and permissions."}`);
  return data;
}
export async function findUser(config, email) {
  for (let page = 1; ; page++) {
    const result = await request(config, `/auth/v1/admin/users?page=${page}&per_page=100`, undefined, "GET");
    const user = result.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (result.users.length < 100) return null;
  }
}
export async function provision(config, email, name, password) {
  await request(config, "/rest/v1/approved_emails?on_conflict=email", { email, active: true });
  const existing = await findUser(config, email);
  if (existing) return existing;
  return request(config, "/auth/v1/admin/users", { email, password, email_confirm: true, user_metadata: { display_name: name } });
}
export async function signIn(config, email, password) {
  const result = await request(config, "/auth/v1/token?grant_type=password", { email, password }, "POST", config.key);
  return result.access_token;
}
export async function rpc(config, token, name, body) { return request(config, `/rest/v1/rpc/${name}`, body, "POST", token); }
