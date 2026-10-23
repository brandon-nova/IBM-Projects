import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireViewer } from "./auth";
import { createClient } from "./supabase/server";
import type { ActionState } from "./action-state";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string; message: string };
export function errorState(error: unknown): ActionState {
  if (error instanceof z.ZodError) return { success: false, message: error.issues[0]?.message ?? "Check the form." };
  const db = error as DbError | undefined;
  if (db?.code === "P0001") return { success: false, message: db.message };
  if (db?.code === "42501") return { success: false, message: "You do not have permission to do that. Your access may have changed." };
  return { success: false, message: "We couldn't save that. Check your entries and try again." };
}
export async function mutate(work: (client: Client) => PromiseLike<{ error: DbError | null }>, message: string): Promise<ActionState> {
  await requireViewer();
  try {
    const client = await createClient();
    const { error } = await work(client);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { success: true, message };
  } catch (error) { return errorState(error); }
}

