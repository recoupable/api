import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts a new row into the `sessions` table and returns it.
 *
 * @param row - The session row to insert.
 * @returns The inserted row, or `null` if the insert failed.
 */
export async function insertSession(
  row: TablesInsert<"sessions">,
): Promise<Tables<"sessions"> | null> {
  const { data, error } = await supabase.from("sessions").insert(row).select().maybeSingle();

  if (error) {
    console.error("Error inserting session:", error);
    return null;
  }

  return data;
}
