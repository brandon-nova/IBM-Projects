type ConfirmationType = "email" | "signup" | "recovery";
export type EmailConfirmation =
  | { kind: "token"; tokenHash: string; type: ConfirmationType }
  | { kind: "code"; code: string };
type Params = Record<string, string | string[] | undefined>;
type AuthError = { status?: number };
type ConfirmationResult = { error: AuthError | null; data?: unknown };
type ConfirmationAuth = {
  verifyOtp(input: { token_hash: string; type: ConfirmationType }): PromiseLike<ConfirmationResult>;
  exchangeCodeForSession(code: string): PromiseLike<ConfirmationResult>;
};

// GET only parses the link. The browser redeems it through a POST after hydration;
// a plain GET or Next.js prefetch must not consume a one-time token.
export function readEmailConfirmation(params: Params): EmailConfirmation | null {
  if (params.error || params.error_code || params.error_description) return null;
  const { token_hash: tokenHash, type, code } = params;
  const valid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 2048 && !/\s/.test(value);
  if (tokenHash !== undefined && code !== undefined) return null;
  if (valid(tokenHash) && (type === "email" || type === "signup" || type === "recovery")) return { kind: "token", tokenHash, type };
  if (tokenHash === undefined && type === undefined && valid(code)) return { kind: "code", code };
  return null;
}

export type ConfirmationOutcome = { destination: string; verifiedUserId?: string };

export async function redeemEmailConfirmation(auth: ConfirmationAuth, link: EmailConfirmation): Promise<ConfirmationOutcome> {
  try {
    const result = link.kind === "token"
      ? await auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await auth.exchangeCodeForSession(link.code);
    if (result.error) {
      if (result.error.status === 0 || (result.error.status ?? 0) >= 500) return { destination: "/login?notice=email-unavailable" };
      return { destination: link.kind === "code" ? "/login?notice=email-browser" : "/login?notice=expired" };
    }
    const data = result.data;
    const recovery = link.kind === "token" ? link.type === "recovery" : typeof data === "object" && data !== null && "redirectType" in data && data.redirectType === "recovery";
    const user = typeof data === "object" && data !== null && "user" in data ? data.user : null;
    const verifiedUserId = typeof user === "object" && user !== null && "id" in user && typeof user.id === "string" ? user.id : undefined;
    return { destination: recovery ? "/reset-password" : "/", verifiedUserId };
  } catch {
    return { destination: "/login?notice=email-unavailable" };
  }
}

export async function confirmationFingerprint(link: EmailConfirmation): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(link));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// This cookie is a UI hint only. It cannot authenticate, confirm an email, or
// grant access. Reuse also requires a server-validated confirmed user and active
// workspace access. Never apply it to password recovery.
export function matchesConfirmationReceipt(value: string | undefined, fingerprint: string, user: { id: string; email_confirmed_at?: string | null } | null): boolean {
  if (!value || value.length > 256 || !user?.email_confirmed_at) return false;
  try {
    const receipt = JSON.parse(value);
    return receipt?.fingerprint === fingerprint && receipt?.userId === user.id;
  } catch { return false; }
}

export function confirmationFailure(destination: string): string {
  if (destination === "/login?notice=expired") return "This link has expired or has already been used. If you already verified your email, sign in. Otherwise request a new verification email.";
  if (destination === "/login?notice=email-browser") return "We couldn’t finish signing you in. Open the newest email in the browser where you signed up. If your email is already verified, sign in below.";
  if (destination === "/login?notice=email-link") return "This link is incomplete. Request a new verification email.";
  return "We couldn’t finish signing you in because the verification service could not be reached. Your email may already be confirmed. Try signing in below, or try this link again shortly.";
}
