import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/config";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const origin = appOrigin();
  if (token_hash && (type === "email" || type === "signup" || type === "recovery")) {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : "/", origin));
  }
  return NextResponse.redirect(new URL("/login?notice=expired", origin));
}
