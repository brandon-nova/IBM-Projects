import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";
import { supabaseConfig } from "../config";

export async function createClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server components are read-only; proxy refreshes the cookies. */ }
      },
    },
  });
}
