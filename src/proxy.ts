import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/config";
import type { Database } from "@/lib/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const protectedRoute = /^\/(projects|people|learning|admin|reset-password)(\/|$)/.test(request.nextUrl.pathname);
  function redirectTo(path: string) {
    const redirect = NextResponse.redirect(new URL(path,request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control","private, no-store");
    return redirect;
  }
  const config = supabaseConfig();
  if (!config) return protectedRoute ? redirectTo("/login?notice=setup") : response;
  const client = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await client.auth.getUser();
  // Redirect before rendering/streaming. Server Actions, the data layer, and
  // RLS independently repeat authorization; the proxy is not the trust boundary.
  if (protectedRoute) {
    if (!user) return redirectTo("/login?notice=access");
    const { data: active, error } = await client.rpc("workspace_active");
    if (error || !active) return redirectTo("/login?notice=access");
    if (/^\/admin(\/|$)/.test(request.nextUrl.pathname)) {
      const { data: admin, error: roleError } = await client.rpc("workspace_admin");
      if (roleError || !admin) return redirectTo("/");
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
