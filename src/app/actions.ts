"use server";

import { mutate, errorState } from "@/lib/action-mutation";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appOrigin, supabaseConfig } from "@/lib/config";
import { normalizeInterest } from "@/lib/domain";
import { accessSchema, deliverableSchema, idSchema, interestSchema, loginSchema, passwordSchema, profileSchema, projectCreateSchema, projectSchema, resetRequestSchema, signupSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
import { authFailure } from "@/lib/auth-feedback";

function values(form: FormData) { return Object.fromEntries(form.entries()); }
function id(form: FormData, key = "project_id") { return idSchema.parse(form.get(key)); }
function booleanField(form: FormData, key: string) { return z.enum(["true", "false"]).parse(form.get(key)) === "true"; }
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
    if (error) return authFailure("signup", error);
    return { success: true, message: "Check your inbox and spam folder. Open the newest verification email and select Verify email to confirm your address and sign in. Already registered? Sign in or resend verification." };
  } catch (error) { return error instanceof z.ZodError ? errorState(error) : authFailure("signup", error); }
}
export async function resendVerification(_: ActionState, form: FormData): Promise<ActionState> {
  if (!supabaseConfig()) return { success: false, message: "Email verification is temporarily unavailable." };
  try {
    const { email } = resetRequestSchema.parse(values(form));
    const client = await createClient();
    const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${appOrigin()}/auth/confirm` } });
    if (error) return authFailure("resend", error);
    return { success: true, message: "If this address has an unconfirmed account, we requested a new verification email. Check your inbox and spam folder. Select Verify email in the newest message to confirm your address and sign in." };
  } catch (error) { return error instanceof z.ZodError ? errorState(error) : authFailure("resend", error); }
}
export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  if (!supabaseConfig()) return { success: false, message: "Configure Supabase to enable password recovery." };
  try {
    const { email } = resetRequestSchema.parse(values(form));
    const client = await createClient();
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin()}/auth/confirm` });
    if (error) return authFailure("recovery", error);
    return { success: true, message: "If this address has an account, we requested a password-reset email. Check your inbox and spam folder." };
  } catch (error) { return error instanceof z.ZodError ? errorState(error) : authFailure("recovery", error); }
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
    const v = profileSchema.parse({ ...values(form), existing_skills: form.getAll("existing_skills"), learning_skills: form.getAll("learning_skills") });
    return client.rpc("save_profile_skills", { p_display_name: v.display_name, p_bio: v.bio,
      p_existing_ids: v.existing_skills, p_learning_ids: v.learning_skills,
      p_available_hours: v.available_hours === "" ? null : Number(v.available_hours) });
  }, "Profile saved.");
}
export async function setDirectoryVisibility(_: ActionState, form: FormData) {
  return mutate((client) => client.rpc("set_directory_visibility", {
    p_hidden: booleanField(form, "hidden_from_people"),
  }), "People visibility saved.");
}
export async function searchInterest(_: ActionState, form: FormData) {
  await requireViewer();
  let query: string;
  try { query = normalizeInterest(interestSchema.parse(form.get("interest"))); }
  catch (error) { return errorState(error); }
  redirect(`/projects?q=${encodeURIComponent(query)}`);
}
export async function createProject(_: ActionState, form: FormData) {
  const viewer = await requireViewer();
  let projectId = "";
  const result = await mutate(async (client) => {
    const v = projectCreateSchema.parse({ ...values(form), skills: form.getAll("skills") });
    const input = { p_title: v.title, p_description: v.description, p_skill_ids: v.skills, p_estimated_hours: v.estimated_hours === "" ? null : Number(v.estimated_hours) };
    const result = viewer.role === "admin"
      ? await client.rpc("create_published_project", { ...input, p_owner_id: idSchema.parse(form.get("owner_id") || viewer.id) })
      : await client.rpc("create_project_with_skills", input);
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
    const v = projectSchema.parse({ ...values(form), skills: form.getAll("skills") });
    return client.rpc("edit_project_with_skills", { p_project_id: projectId, p_title: v.title, p_description: v.description, p_skill_ids: v.skills, p_estimated_hours: v.estimated_hours === "" ? null : Number(v.estimated_hours) });
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
