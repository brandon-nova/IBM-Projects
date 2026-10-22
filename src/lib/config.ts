export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
export function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== "/" || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) {
      throw new Error("NEXT_PUBLIC_APP_URL must be an HTTPS origin in production.");
    }
    return url.origin;
  }
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("Set NEXT_PUBLIC_APP_URL before deploying.");
}
