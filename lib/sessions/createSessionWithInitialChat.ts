import { generateUUID } from "@/lib/uuid/generateUUID";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import { buildSessionInsertRow } from "@/lib/sessions/buildSessionInsertRow";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { deleteSessionById } from "@/lib/supabase/sessions/deleteSessionById";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import type { Tables } from "@/types/database.types";

export type CreateSessionWithChatResult =
  | { ok: true; session: Tables<"sessions">; chat: Tables<"chats"> }
  | { ok: false; reason: "repo" | "insert" };

/**
 * Shared core for provisioning a session + its initial chat — used by both the
 * interactive `POST /api/sessions` (`createSessionHandler`) and the headless
 * `POST /api/chat/runs` path (`provisionRunSession`), so the two stay in
 * lockstep (recoupable/chat#1813).
 *
 * Ensures the workspace repo exists (`recoupable/<workspaceAccountId>`), inserts
 * the session row, then the initial chat row. If the chat insert fails after the
 * session is persisted, the session is rolled back so callers never observe an
 * orphaned session.
 *
 * The clone URL is derived server-side. `workspaceAccountId` (org id for org
 * sessions) defaults to `accountId` for personal sessions.
 *
 * @returns `{ ok: true, session, chat }`, or `{ ok: false, reason }` where
 *   `"repo"` = workspace-repo provisioning failed and `"insert"` = a session/chat
 *   insert failed (session already rolled back). Callers map these to their own
 *   error envelope (the route returns 502/500; the headless path throws).
 */
export async function createSessionWithInitialChat({
  accountId,
  workspaceAccountId,
  title,
  chatTitle,
  artistId,
}: {
  accountId: string;
  workspaceAccountId?: string;
  title: string;
  chatTitle: string;
  artistId?: string;
}): Promise<CreateSessionWithChatResult> {
  const cloneUrl = await ensurePersonalRepo({ accountId: workspaceAccountId ?? accountId });
  if (!cloneUrl) return { ok: false, reason: "repo" };

  const session = await insertSession(
    buildSessionInsertRow({ accountId, title, cloneUrl, artistId }),
  );
  if (!session) return { ok: false, reason: "insert" };

  const chat = await insertChat({ id: generateUUID(), session_id: session.id, title: chatTitle });
  if (!chat) {
    const rolledBack = await deleteSessionById(session.id);
    if (!rolledBack) {
      console.error(
        "[createSessionWithInitialChat] chat insert failed and session rollback failed — orphaned session:",
        session.id,
      );
    }
    return { ok: false, reason: "insert" };
  }

  return { ok: true, session, chat };
}
