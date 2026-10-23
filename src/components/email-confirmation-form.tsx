"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { confirmEmail } from "@/app/auth/confirm/actions";
import { initialState } from "@/lib/action-state";
import type { EmailConfirmation } from "@/lib/email-confirmation";
import { Button } from "./ui/button";

export function EmailConfirmationForm({ link }: { link: EmailConfirmation }) {
  const [state, action, pending] = useActionState(confirmEmail, initialState);
  const form = useRef<HTMLFormElement>(null);
  const started = useRef(false);
  const recovery = link.kind === "token" && link.type === "recovery";

  useEffect(() => {
    // Run once, including during React's development effect replay. Never retry
    // one-time tokens automatically after an error or a state update.
    if (!recovery && !started.current) {
      started.current = true;
      form.current?.requestSubmit();
    }
  }, [recovery]);

  return <form ref={form} action={action} aria-busy={pending} onSubmit={() => { started.current = true; }}>
    {link.kind === "token" ? <>
      <input type="hidden" name="token_hash" value={link.tokenHash} />
      <input type="hidden" name="type" value={link.type} />
    </> : <input type="hidden" name="code" value={link.code} />}
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
      {pending ? (recovery ? "Continuing…" : "Verifying and signing you in…") : state.message ? "Try again" : recovery ? "Continue to reset password" : "Verify and sign in"}
    </Button>
    <p role={state.message ? "alert" : "status"} className={state.message ? "notice notice-error mt-4" : "sr-only"}>
      {state.message || (pending ? "Please wait while we verify your link." : "")}
    </p>
  </form>;
}
