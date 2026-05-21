import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Discriminated result so callers can distinguish:
 *   - `{ ok: true, row, isDuplicate }` — known outcome; row is null when the
 *     existing `id` conflict was silently ignored.
 *   - `{ ok: false, error }` — Supabase failure. Visible to logs so transient
 *     DB problems aren't masked as duplicates.
 */
export type UpsertChatMessageResult =
  | { ok: true; row: Tables<"chat_messages"> | null; isDuplicate: boolean }
  | { ok: false; error: string };

/**
 * Insert-or-skip a single chat message row. Wraps Supabase upsert with
 * `ignoreDuplicates: true` on the `id` primary key, but returns a
 * discriminated result so callers can tell "duplicate skipped" apart from
 * "DB error" — the previous helper returned `null` for both, which made
 * callers silently swallow operational failures.
 */
export async function upsertChatMessage(
  data: TablesInsert<"chat_messages">,
): Promise<UpsertChatMessageResult> {
  const { data: row, error } = await supabase
    .from("chat_messages")
    .upsert(data, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) {
    console.error("[upsertChatMessage] error:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, row, isDuplicate: row === null };
}
