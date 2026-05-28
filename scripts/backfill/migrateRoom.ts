import { v5 as uuidv5 } from "uuid";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import type { Json, Tables } from "@/types/database.types";

export type MigrationResult = "migrated" | "skipped" | "failed";

// Fixed namespace so uuidv5(room.id) yields the same sessionId every run.
// A re-run after partial failure then finds the existing session via the
// guard below instead of minting an orphan.
const SESSION_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

async function migrateMessages(roomId: string): Promise<number> {
  const memories = await selectMemories(roomId, { ascending: true });
  if (!memories?.length) return 0;

  let count = 0;
  for (const memory of memories) {
    // Legacy memories store content as { role, parts, content } (see
    // lib/messages/filterMessageContentForMemories); chat_messages wants
    // role + parts. `update: false` makes the upsert write-once/idempotent.
    const content = memory.content as { role: string; parts: Json };
    const result = await upsertChatMessage(
      {
        id: memory.id,
        chat_id: roomId,
        role: content.role,
        parts: content.parts,
        created_at: memory.updated_at,
      },
      { update: false },
    );
    if ("error" in result) {
      throw new Error(`chat_messages upsert failed for ${memory.id}: ${result.error}`);
    }
    count++;
  }

  return count;
}

export async function migrateRoom(room: Tables<"rooms">): Promise<MigrationResult> {
  if (!room.account_id) {
    console.warn(`⚠️  Skipping room ${room.id} — no account_id`);
    return "skipped";
  }

  const sessionId = uuidv5(room.id, SESSION_NAMESPACE);
  const title = room.topic ?? "Untitled";

  // insertSession / insertChat are plain inserts; guard with a select so
  // re-runs are idempotent and don't error on the existing primary key.
  const existingSession = await selectSessions({ id: sessionId });
  if (!existingSession?.length) {
    const session = await insertSession({
      id: sessionId,
      account_id: room.account_id,
      title,
      created_at: room.updated_at,
      updated_at: room.updated_at,
    });
    if (!session) throw new Error(`Failed to insert session for room ${room.id}`);
  }

  // Preserve room.id as chat.id so /chat/[roomId] URLs keep working.
  const existingChat = await selectChats({ id: room.id });
  if (!existingChat.length) {
    const chat = await insertChat({
      id: room.id,
      session_id: sessionId,
      title,
      created_at: room.updated_at,
      updated_at: room.updated_at,
    });
    if (!chat) throw new Error(`Failed to insert chat for room ${room.id}`);
  }

  const count = await migrateMessages(room.id);
  console.log(`✅ Migrated room ${room.id} → session ${sessionId} (${count} messages)`);
  return "migrated";
}
