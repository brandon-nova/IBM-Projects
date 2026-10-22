import { randomUUID } from "node:crypto";

export type Actor = { id: string; email: string; password: string; name: string; token: string };
type ApiResponse<T> = { status: number; data: T };
export async function fixtures() {
  const url = process.env.TEST_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.TEST_SUPABASE_KEY;
  const service = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.TEST_PASSWORD;
  if (!url || !key || !service || !password || password.length < 12) throw new Error("Real Supabase tests require .env.test: TEST_SUPABASE_URL, TEST_SUPABASE_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY, and TEST_PASSWORD (12+ characters). Tests were not run.");
  const hostname = new URL(url).hostname;
  if (!["127.0.0.1","localhost","[::1]"].includes(hostname) && process.env.ALLOW_REMOTE_TESTS !== "true") throw new Error("Use local Supabase, or explicitly set ALLOW_REMOTE_TESTS=true for a disposable test project. Never run against production.");
  const runId = randomUUID().replaceAll("-", "").slice(0,16);
  const created: Actor[] = [];
  const approved: string[] = [];
  async function call<T = unknown>(path: string, method = "GET", body?: unknown, token: string = key!): Promise<ApiResponse<T>> {
    const response = await fetch(`${url}${path}`, { method,
      headers: { apikey:key!, Authorization:`Bearer ${token}`, "Content-Type":"application/json", Prefer:"return=representation" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status:response.status, data:(text ? JSON.parse(text) : null) as T };
  }
  async function ok<T>(path: string, method = "GET", body?: unknown, token: string = key!): Promise<T> {
    const response = await call<T>(path,method,body,token);
    if (response.status >= 400) throw new Error(`Test setup/request failed: ${method} ${path.split("?")[0]} returned ${response.status}. Check the migrations and test credentials.`);
    return response.data;
  }
  async function actor(label: string, admin = false): Promise<Actor> {
    const email = `test-${runId}-${label}@soverflow.example`;
    const name = `Fictional ${label} ${runId}`;
    await ok("/rest/v1/approved_emails","POST",{email,active:true},service);
    approved.push(email);
    const user = await ok<{id:string}>("/auth/v1/admin/users","POST",{email,password,email_confirm:true,user_metadata:{display_name:name,role:"admin"}},service);
    const temporary = {id:user.id,email,password:password!,name,token:""};
    created.push(temporary);
    if (admin) await ok(`/rest/v1/user_roles?user_id=eq.${user.id}`,"PATCH",{role:"admin"},service);
    const auth = await ok<{access_token:string}>("/auth/v1/token?grant_type=password","POST",{email,password});
    temporary.token = auth.access_token;
    return temporary;
  }
  async function rpc<T = string>(user: Actor, name: string, args: unknown) { return ok<T>(`/rest/v1/rpc/${name}`,"POST",args,user.token); }
  async function cleanup() {
    // Delete only fixture-owned projects and accounts. No resets or global deletes.
    for (const user of created) await ok(`/rest/v1/projects?creator_id=eq.${user.id}`,"DELETE",undefined,service);
    for (const user of created) {
      // Last-admin protections apply to app callers, not this provisioning client.
      await ok(`/auth/v1/admin/users/${user.id}`,"DELETE",undefined,service);
    }
    for (const email of approved) await ok(`/rest/v1/approved_emails?email=eq.${encodeURIComponent(email)}`,"DELETE",undefined,service);
  }
  return { actor, call, ok, rpc, cleanup, runId, service };
}
