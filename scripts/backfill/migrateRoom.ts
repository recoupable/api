import { v5 as uuidv5 } from "uuid";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import { upsertChatMessages } from "@/lib/supabase/chat_messages/upsertChatMessages";
import type { Json, Tables, TablesInsert } from "@/types/database.types";
import { paginate } from "./paginate";

// Fixed namespace so uuidv5(room.id) yields the same sessionId every run.
// A re-run after partial failure then finds the existing session via the
// guard below instead of minting an orphan.
const SESSION_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

/** Rooms at/above this many memories are flagged in the run summary. */
export const OVERSIZED_THRESHOLD = 1000;

export interface RoomStats {
  /** "skipped" = no account_id; "migrated" = processed (real or dry). */
  status: "migrated" | "skipped";
  /** Session/chat already existed → insert was a no-op (idempotent re-run). */
  sessionExisted: boolean;
  chatExisted: boolean;
  /** Messages written (real run) or that would be written (dry run). */
  messagesWritten: number;
  /** Memories whose content lacks a usable { role, parts } shape. */
  messagesMalformed: number;
  /** Total memories read for the room. */
  memoryCount: number;
}

interface MigrateOptions {
  dryRun?: boolean;
}

/** Legacy memories store content as { role, parts, content }. */
function isWellFormedContent(content: unknown): content is { role: string; parts: Json } {
  if (!content || typeof content !== "object") return false;
  const candidate = content as { role?: unknown; parts?: unknown };
  return typeof candidate.role === "string" && candidate.parts != null;
}

async function migrateMessages(
  roomId: string,
  dryRun: boolean,
): Promise<{ written: number; malformed: number; memoryCount: number }> {
  const memories = await paginate((from, to) =>
    selectMemories(roomId, { ascending: true, range: { from, to } }).then(m => m ?? []),
  );
  const rows: TablesInsert<"chat_messages">[] = [];
  let malformed = 0;

  for (const memory of memories) {
    const content = memory.content;
    if (!isWellFormedContent(content)) {
      malformed++;
      continue;
    }
    // The workflow persists the FULL UIMessage in the `parts` column
    // (see lib/chat/persistLatestUserMessage / persistAssistantMessage),
    // and the read path (getSessionChatHandler) returns `parts` verbatim
    // expecting a UIMessage. Store the same shape so migrated history
    // deserializes identically to natively-written chats.
    rows.push({
      id: memory.id,
      chat_id: roomId,
      role: content.role,
      parts: { id: memory.id, role: content.role, parts: content.parts },
      created_at: memory.updated_at,
    });
  }

  // Write-once per message, so re-runs never overwrite already-migrated rows.
  const written = dryRun ? rows.length : await upsertChatMessages(rows);

  return { written, malformed, memoryCount: memories.length };
}

export async function migrateRoom(
  room: Tables<"rooms">,
  { dryRun = false }: MigrateOptions = {},
): Promise<RoomStats> {
  if (!room.account_id) {
    console.warn(`⚠️  Skipping room ${room.id} — no account_id`);
    return {
      status: "skipped",
      sessionExisted: false,
      chatExisted: false,
      messagesWritten: 0,
      messagesMalformed: 0,
      memoryCount: 0,
    };
  }

  const sessionId = uuidv5(room.id, SESSION_NAMESPACE);
  const title = room.topic ?? "Untitled";

  // insertSession / insertChat are plain inserts; guard with a select so
  // re-runs are idempotent and don't error on the existing primary key.
  const existingSession = await selectSessions({ id: sessionId });
  const sessionExisted = Boolean(existingSession?.length);
  if (!sessionExisted && !dryRun) {
    const session = await insertSession({
      id: sessionId,
      account_id: room.account_id,
      artist_id: room.artist_id,
      title,
      created_at: room.updated_at,
      updated_at: room.updated_at,
    });
    if (!session) throw new Error(`Failed to insert session for room ${room.id}`);
  }

  // Preserve room.id as chat.id so /chat/[roomId] URLs keep working.
  const existingChat = await selectChats({ id: room.id });
  if (existingChat === null) {
    throw new Error(`Failed to load chat for room ${room.id}`);
  }
  const chatExisted = existingChat.length > 0;
  if (!chatExisted && !dryRun) {
    const chat = await insertChat({
      id: room.id,
      session_id: sessionId,
      title,
      created_at: room.updated_at,
      updated_at: room.updated_at,
    });
    if (!chat) throw new Error(`Failed to insert chat for room ${room.id}`);
  }

  const { written, malformed, memoryCount } = await migrateMessages(room.id, dryRun);

  const verb = dryRun ? "Would migrate" : "Migrated";
  const malformedNote = malformed ? `, ${malformed} malformed skipped` : "";
  console.log(
    `✅ ${verb} room ${room.id} → session ${sessionId} (${written} messages${malformedNote})`,
  );

  return {
    status: "migrated",
    sessionExisted,
    chatExisted,
    messagesWritten: written,
    messagesMalformed: malformed,
    memoryCount,
  };
}
