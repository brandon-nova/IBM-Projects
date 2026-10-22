import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { supabaseConfig } from "./config";

export const getViewer = cache(async () => {
  if (!supabaseConfig()) return null;
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: active, error: accessError } = await client.rpc("workspace_active");
  if (accessError) throw new Error("Unable to verify workspace access. Check database migrations and connectivity.");
  if (!active) return null;
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    client.from("profiles").select("*").eq("user_id", user.id).single(),
    client.from("user_roles").select("*").eq("user_id", user.id).single(),
  ]);
  if (profileError || roleError || !profile || !role) throw new Error("Unable to load your workspace profile.");
  return { id: user.id, email: user.email, profile, role: role.role };
});
export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?notice=access");
  return viewer;
}
export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}
