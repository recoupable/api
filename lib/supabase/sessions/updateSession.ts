import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Updates a `sessions` row by id with any subset of mutable columns.
 * Returns the updated row, or null on Supabase error.
 *
 * @param id - The session id to update.
 * @param updates - Partial column updates (any TablesUpdate<"sessions"> shape).
 * @returns The updated row, or null on error.
 */
export async function updateSession(
  id: string,
  updates: TablesUpdate<"sessions">,
): Promise<Tables<"sessions"> | null> {
  const { data, error } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateSession] error:", error);
    return null;
  }

  return data;
}
