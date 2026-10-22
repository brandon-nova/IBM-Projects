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

// GET only parses the link. Redemption belongs to the explicit POST action so
// previewing a custom-template link cannot consume its one-time token.
export function readEmailConfirmation(params: Params): EmailConfirmation | null {
  if (params.error || params.error_code || params.error_description) return null;
  const { token_hash: tokenHash, type, code } = params;
  const valid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 2048 && !/\s/.test(value);
  if (tokenHash !== undefined && code !== undefined) return null;
  if (valid(tokenHash) && (type === "email" || type === "signup" || type === "recovery")) return { kind: "token", tokenHash, type };
  if (tokenHash === undefined && type === undefined && valid(code)) return { kind: "code", code };
  return null;
}

export async function redeemEmailConfirmation(auth: ConfirmationAuth, link: EmailConfirmation): Promise<string> {
  try {
    const result = link.kind === "token"
      ? await auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      : await auth.exchangeCodeForSession(link.code);
    if (result.error) {
      if (result.error.status === 0 || (result.error.status ?? 0) >= 500) return "/login?notice=email-unavailable";
      return link.kind === "code" ? "/login?notice=email-browser" : "/login?notice=expired";
    }
    const data = result.data;
    const recovery = link.kind === "token" ? link.type === "recovery" : typeof data === "object" && data !== null && "redirectType" in data && data.redirectType === "recovery";
    return recovery ? "/reset-password" : "/";
  } catch {
    return "/login?notice=email-unavailable";
  }
}
