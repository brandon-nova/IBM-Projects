export const productionOrigin = "https://projects.fncai.org";

export function cloudflareSettings(env) {
  if (env.NEXT_PUBLIC_APP_URL !== productionOrigin) {
    throw new Error(`Set NEXT_PUBLIC_APP_URL=${productionOrigin} in .env.production. Localhost must not be deployed.`);
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  if (Boolean(url) !== Boolean(key)) throw new Error("Set both public Supabase values, or leave both empty for an explicit public preview.");
  if (!url && env.CLOUDFLARE_PUBLIC_PREVIEW !== "true") {
    throw new Error("Configure Supabase in .env.production before deployment. For a homepage-only preview, explicitly set CLOUDFLARE_PUBLIC_PREVIEW=true.");
  }
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
      throw new Error("The production Supabase URL must be a public HTTPS origin.");
    }
    if (!key.startsWith("sb_publishable_")) {
      let role;
      try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role; } catch { /* Reject malformed or privileged keys below. */ }
      if (role !== "anon") throw new Error("Use a Supabase publishable or legacy anon key. A service-role/secret key must never be deployed as a public value.");
    }
  }

  return {
    NEXT_PUBLIC_APP_URL: productionOrigin,
    NEXT_PUBLIC_SUPABASE_URL: url.replace(/\/$/, ""),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  };
}
