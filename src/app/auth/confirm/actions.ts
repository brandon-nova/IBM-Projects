"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { appOrigin, supabaseConfig } from "@/lib/config";
import { confirmationFailure, confirmationFingerprint, matchesConfirmationReceipt, readEmailConfirmation, redeemEmailConfirmation } from "@/lib/email-confirmation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

export async function confirmEmail(_: ActionState, form: FormData): Promise<ActionState> {
  const failure = (destination: string): ActionState => ({ success: false, message: confirmationFailure(destination) });
  const params: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (["token_hash", "type", "code"].includes(name)) {
      if (typeof value !== "string" || name in params) return failure("/login?notice=email-link");
      params[name] = value;
    }
  }
  const link = readEmailConfirmation(params);
  if (!link) return failure("/login?notice=email-link");
  if (!supabaseConfig()) return failure("/login?notice=email-unavailable");
  // Validate the destination before consuming a one-time token.
  const origin = appOrigin();
  const client = await createClient();
  const store = await cookies();
  const receiptName = "ibm_email_confirmation";
  const recovery = link.kind === "token" && link.type === "recovery";
  const fingerprint = await confirmationFingerprint(link);
  let repeated = false;
  if (!recovery && store.has(receiptName)) {
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && matchesConfirmationReceipt(store.get(receiptName)?.value, fingerprint, user)) {
      const { data: active, error: accessError } = await client.rpc("workspace_active");
      repeated = !accessError && active === true;
    }
  }
  const { destination, verifiedUserId } = repeated ? { destination: "/", verifiedUserId: undefined } : await redeemEmailConfirmation(client.auth, link);
  if (destination !== "/" && destination !== "/reset-password") return failure(destination);
  if (destination === "/" && verifiedUserId) {
    store.set(receiptName, JSON.stringify({ fingerprint, userId: verifiedUserId }), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/auth/confirm", maxAge: 60 * 60 * 24 * 30,
    });
  }
  redirect(new URL(destination === "/" ? "/?notice=email-verified" : destination, origin).toString());
}
