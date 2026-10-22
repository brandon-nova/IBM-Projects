"use server";

import { redirect } from "next/navigation";
import { appOrigin, supabaseConfig } from "@/lib/config";
import { readEmailConfirmation, redeemEmailConfirmation } from "@/lib/email-confirmation";
import { createClient } from "@/lib/supabase/server";

export async function confirmEmail(form: FormData) {
  const params: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (["token_hash", "type", "code"].includes(name)) {
      if (typeof value !== "string" || name in params) redirect("/login?notice=email-link");
      params[name] = value;
    }
  }
  const link = readEmailConfirmation(params);
  if (!link) redirect("/login?notice=email-link");
  if (!supabaseConfig()) redirect("/login?notice=email-unavailable");
  // Validate the destination before consuming a one-time token.
  const origin = appOrigin();
  const client = await createClient();
  const destination = await redeemEmailConfirmation(client.auth, link);
  redirect(new URL(destination, origin).toString());
}
