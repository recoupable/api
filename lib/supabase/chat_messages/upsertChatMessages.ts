import supabase from "@/lib/supabase/serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Batch-upserts chat messages on the `id` primary key, write-once
 * (`ignoreDuplicates` → DO NOTHING on conflict), so re-runs never
 * overwrite already-migrated messages. One round-trip for the whole
 * batch; on a batch error it falls back to per-row upserts so a single
 * bad row doesn't block the rest. Throws if any row ultimately fails.
 * Returns the number of rows attempted (duplicates count as success).
 *
 * Used by the Phase 2 backfill — far fewer round-trips than calling the
 * singular `upsertChatMessage` once per message.
 */
export async function upsertChatMessages(rows: TablesInsert<"chat_messages">[]): Promise<number> {
  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("chat_messages")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (!error) return rows.length;

  console.warn("⚠️  Batch chat_messages upsert failed, retrying per-row:", error.message);

  let succeeded = 0;
  for (const row of rows) {
    const { error: rowError } = await supabase
      .from("chat_messages")
      .upsert(row, { onConflict: "id", ignoreDuplicates: true });
    if (rowError) {
      console.error(`  ❌ Skipping message ${row.id}:`, rowError.message);
    } else {
      succeeded++;
    }
  }

  if (succeeded !== rows.length) {
    throw new Error(`Failed to upsert ${rows.length - succeeded} of ${rows.length} chat_messages`);
  }
  return succeeded;
}
