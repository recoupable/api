import type { TablesInsert } from "@/types/database.types";
import { upsertChatMessage } from "./upsertChatMessage";

/**
 * Upsert many chat messages by delegating each row to the single-row
 * `upsertChatMessage` helper — no query is defined here. Write-once
 * (`update: false` → DO NOTHING on conflict), so re-runs never overwrite
 * already-migrated messages. A single bad row doesn't block the rest;
 * throws if any row ultimately fails. Returns the number of rows attempted
 * (duplicates count as success).
 *
 * Used by the Phase 2 backfill.
 */
export async function upsertChatMessages(rows: TablesInsert<"chat_messages">[]): Promise<number> {
  let succeeded = 0;
  for (const row of rows) {
    const result = await upsertChatMessage(row, { update: false });
    if ("error" in result) {
      console.error(`  ❌ Skipping message ${row.id}:`, result.error);
    } else {
      succeeded++;
    }
  }

  if (succeeded !== rows.length) {
    throw new Error(`Failed to upsert ${rows.length - succeeded} of ${rows.length} chat_messages`);
  }
  return succeeded;
}
