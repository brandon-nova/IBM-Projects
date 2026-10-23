import type { ActionState } from "./action-state.ts";

type Operation = "signup" | "resend" | "recovery";
const messages: Record<string, string> = {
  over_email_send_rate_limit: "Too many emails were requested. Wait a few minutes before trying again.",
  over_request_rate_limit: "Too many attempts. Wait a few minutes before trying again.",
  email_address_not_authorized: "We couldn’t send the email. Ask your administrator to check email delivery.",
  email_address_invalid: "Use a valid work email address.",
  signup_disabled: "New accounts are temporarily unavailable. Contact your administrator.",
  email_provider_disabled: "Email signup is temporarily unavailable. Contact your administrator.",
  weak_password: "Choose a stronger password with at least 12 characters.",
  unexpected_failure: "Account setup or email delivery failed. Ask your administrator to check the setup.",
  hook_timeout: "Account setup took too long. Try again shortly.",
  hook_timeout_after_retry: "Account setup took too long. Try again shortly.",
};

// Never log raw provider messages, emails, passwords, sessions, or token URLs.
// A reference lets an administrator find this event in Cloudflare Worker logs.
export function authFailure(operation: Operation, error: unknown): ActionState {
  const provider = error && typeof error === "object" ? error as { code?: unknown; status?: unknown } : {};
  const code = typeof provider.code === "string" && Object.hasOwn(messages, provider.code) ? provider.code : "unknown";
  const status = typeof provider.status === "number" && Number.isInteger(provider.status) && provider.status >= 0 && provider.status <= 599 ? provider.status : undefined;
  const reference = crypto.randomUUID().slice(0, 13);
  console.error(JSON.stringify({ event: "auth_failure", operation, reference, code, status }));
  const fallback = operation === "signup"
    ? "We couldn’t create the account. Use your @ibm.com address or an email approved by an administrator. If you already registered, try signing in or resending verification."
    : "We couldn’t request the email. Try again shortly or contact your administrator.";
  // Supabase's SDK can omit the provider code on 5xx responses.
  const message = messages[code] ?? (status !== undefined && status >= 500 ? messages.unexpected_failure
    : status === 0 ? "We couldn’t reach the account service. Try again shortly." : fallback);
  return { success: false, message: `${message} Reference: ${reference}.` };
}
