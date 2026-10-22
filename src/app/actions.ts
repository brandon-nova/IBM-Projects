"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appOrigin, supabaseConfig } from "@/lib/config";
import { normalizeInterest, splitSkills } from "@/lib/domain";
import { accessSchema, deliverableSchema, idSchema, interestSchema, loginSchema, passwordSchema, profileSchema, projectSchema, resetRequestSchema, signupSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };
function errorState(error: unknown): ActionState {
  if (error instanceof z.ZodError) return { success: false, message: error.issues[0]?.message ?? "Check the form." };
  const db = error as DbError | undefined;
  if (db?.code === "P0001") return { success: false, message: db.message };
  if (db?.code === "42501") return { success: false, message: "You do not have permission to do that. Your access may have changed." };
  return { success: false, message: "We couldn't save that. Check your entries and try again." };
}
function values(form: FormData) { return Object.fromEntries(form.entries()); }
function id(form: FormData, key = "project_id") { return idSchema.parse(form.get(key)); }
function booleanField(form: FormData, key: string) { return z.enum(["true", "false"]).parse(form.get(key)) === "true"; }
async function mutate(work: (client: Client) => PromiseLike<{ error: DbError | null }>, message: string): Promise<ActionState> {
  await requireViewer();
  try {
    const client = await createClient();
    const { error } = await work(client);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { success: true, message };
  } catch (error) { return errorState(error); }
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  if (!supabaseConfig()) return { success: false, message: "Configure Supabase to enable sign in. See the setup instructions." };
  try {
    const input = loginSchema.parse(values(form));
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword(input);
    if (error) return { success: false, message: "Check your email and password, and confirm your email before signing in." };
    const { data: active, error: accessError } = await client.rpc("workspace_active");
    if (accessError || !active) {
      await client.auth.signOut({ scope: "local" });
      return { success: false, message: "Your account does not currently have workspace access. Contact an administrator." };
    }
  } catch (error) { return errorState(error); }
  redirect("/");
}
export async function signup(_: ActionState, form: FormData): Promise<ActionState> {
  if (!supabaseConfig()) return { success: false, message: "Configure Supabase to enable registration." };
  try {
    const input = signupSchema.parse(values(form));
    const client = await createClient();
    const { error } = await client.auth.signUp({
      email: input.email, password: input.password,
      options: { data: { display_name: input.display_name }, emailRedirectTo: `${appOrigin()}/auth/confirm` },
    });
    if (error) return { success: false, message: "Account creation was not available. Use your @ibm.com email or an address approved by an administrator." };
    return { success: true, message: "Check your email to confirm your account, then sign in. Already registered? Use Sign in." };
  } catch (error) { return errorState(error); }
}
export async function resendVerification(_: ActionState, form: FormData): Promise<ActionState> {
  if (!supabaseConfig()) return { success: false, message: "Email verification is temporarily unavailable." };
  try {
    const { email } = resetRequestSchema.parse(values(form));
    const client = await createClient();
    const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${appOrigin()}/auth/confirm` } });
    if (error) return { success: false, message: "We couldn't send a verification email right now. Wait a moment and try again." };
    return { success: true, message: "If this address has an unconfirmed account, a new email is on its way. Open the newest email, then select Confirm email on the page." };
  } catch (error) { return errorState(error); }
}
export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  if (!supabaseConfig()) return { success: false, message: "Configure Supabase to enable password recovery." };
  try {
    const { email } = resetRequestSchema.parse(values(form));
    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/auth/confirm` });
    if (error) return { success: false, message: "Password recovery is temporarily unavailable. Try again or contact an administrator." };
    return { success: true, message: "If this address has an account, a password-reset email is on its way." };
  } catch (error) { return errorState(error); }
}
export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  await requireViewer();
  try {
    const { password } = passwordSchema.parse(values(form));
    const client = await createClient();
    const { error } = await client.auth.updateUser({ password });
    if (error) return { success: false, message: "The password could not be changed. Request a new reset link or follow the email reauthentication instructions." };
    await client.auth.signOut({ scope: "local" });
  } catch (error) { return errorState(error); }
  redirect("/login?notice=password");
}
export async function logout() {
  if (supabaseConfig()) { const client = await createClient(); await client.auth.signOut({ scope: "local" }); }
  redirect("/login");
}
export async function saveProfile(_: ActionState, form: FormData) {
  return mutate(async (client) => {
    const v = profileSchema.parse(values(form));
    return client.rpc("save_profile", { p_display_name: v.display_name, p_bio: v.bio,
      p_existing_skills: splitSkills(v.existing_skills), p_learning_skills: splitSkills(v.learning_skills),
      p_available_hours: v.available_hours === "" ? null : Number(v.available_hours) });
  }, "Profile saved.");
}
export async function searchInterest(_: ActionState, form: FormData) {
  let query = "";
  const result = await mutate(async (client) => {
    query = normalizeInterest(interestSchema.parse(form.get("interest")));
    return client.rpc("save_interest", { p_interest: query });
  }, "Interest saved.");
  if (!result.success) return result;
  redirect(`/projects?q=${encodeURIComponent(query)}`);
}
export async function createProject(_: ActionState, form: FormData) {
  let projectId = "";
  const result = await mutate(async (client) => {
    const v = projectSchema.parse(values(form));
    const result = await client.rpc("create_project", { p_title: v.title, p_description: v.description, p_skills: splitSkills(v.skills), p_estimated_hours: v.estimated_hours === "" ? null : Number(v.estimated_hours) });
    projectId = result.data ?? "";
    return result;
  }, "Proposal created.");
  if (!result.success) return result;
  redirect(`/projects/${projectId}`);
}
export async function editProject(_: ActionState, form: FormData) {
  let projectId = "";
  const result = await mutate(async (client) => {
    projectId = id(form);
    const v = projectSchema.parse(values(form));
    return client.rpc("edit_project", { p_project_id: projectId, p_title: v.title, p_description: v.description, p_skills: splitSkills(v.skills), p_estimated_hours: v.estimated_hours === "" ? null : Number(v.estimated_hours) });
  }, "Project saved.");
  if (!result.success) return result;
  redirect(`/projects/${projectId}`);
}
export async function requestPublication(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("request_publication", { p_project_id: id(form) }), "Sent for approval. Your project remains private while it is reviewed.");
}
export async function assignOwner(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("assign_owner", { p_project_id: id(form), p_owner_id: id(form, "owner_id") }), "Official owner assigned.");
}
export async function reviewPublication(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("review_publication", { p_project_id: id(form), p_approve: booleanField(form, "approve") }), "Publication decision saved.");
}
export async function requestJoin(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("request_join", { p_project_id: id(form) }), "Request sent. The owner will review it.");
}
export async function reviewJoin(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("review_join", { p_request_id: id(form, "request_id"), p_accept: booleanField(form, "accept") }), "Join request reviewed.");
}
export async function submitDeliverable(_: ActionState, form: FormData) {
  return mutate((client) => {
    const v = deliverableSchema.parse(values(form));
    return client.rpc("submit_deliverable", { p_project_id: id(form), p_url: v.url, p_summary: v.summary, p_outcome: v.outcome });
  }, "Work submitted. Your owner can now review it.");
}
export async function reviewDeliverable(_: ActionState, form: FormData) {
  return mutate((client) => {
    const accept = booleanField(form, "accept");
    if (accept && form.get("confirm_useful") !== "yes") throw new z.ZodError([{ code: "custom", path: [], message: "Confirm that this contribution was useful before accepting it." }]);
    return client.rpc("review_deliverable", { p_deliverable_id: id(form, "deliverable_id"), p_accept: accept, p_feedback: z.string().trim().max(1000).parse(form.get("feedback") ?? "") });
  }, "Contribution reviewed.");
}
export async function completeProject(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("complete_project", { p_project_id: id(form) }), "Project completed. Verified contributions now appear on participant profiles.");
}
export async function startProject(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("start_project", { p_project_id: id(form) }), "Project marked in progress.");
}
export async function manageAccess(_: ActionState, form: FormData) {
  return mutate((client) => {
    const v = accessSchema.parse(values(form));
    return client.rpc("manage_access", { p_email: v.email.toLowerCase(), p_active: v.active === "true" });
  }, "Access updated. Revoked access applies to existing sessions immediately.");
}
export async function setUserRole(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("set_user_role", { p_user_id: id(form, "user_id"), p_role: z.enum(["member", "admin"]).parse(form.get("role")) }), "Role updated.");
}
