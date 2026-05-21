import { compareAndSetChatActiveStreamId } from "@/lib/supabase/chats/compareAndSetChatActiveStreamId";
import { selectChats } from "@/lib/supabase/chats/selectChats";

const MAX_ATTEMPTS = 3;

export type ReconcileResult =
  | { action: "resume"; runId: string; stream: ReadableStream<unknown> }
  | { action: "ready" }
  | { action: "conflict" };

/**
 * Resolves what to do when `chats.active_stream_id` is already set at the
 * start of a new chat-workflow request:
 *
 *   - If the referenced workflow run is still alive (`running` | `pending`)
 *     return action=resume with its readable stream — the caller pipes it
 *     back through `createUIMessageStreamResponse`.
 *   - If the run is dead (completed/failed/cancelled or `getRun` throws)
 *     CAS the stale id back to null and return action=ready so the caller
 *     starts a fresh workflow.
 *   - If the CAS loses to a concurrent writer, re-read the chat row and
 *     repeat for up to MAX_ATTEMPTS iterations. After that, return
 *     action=conflict and let the caller surface a 409.
 *
 * @param chatId - The chat being reconciled.
 * @param activeStreamId - Current `chats.active_stream_id` value (non-null).
 */
export async function reconcileExistingActiveStream(
  chatId: string,
  activeStreamId: string,
): Promise<ReconcileResult> {
  const { getRun } = await import("workflow/api");
  let currentStreamId: string | null = activeStreamId;

  for (let attempt = 1; currentStreamId && attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const existingRun = getRun(currentStreamId);
      const status = await existingRun.status;
      if (status === "running" || status === "pending") {
        return {
          action: "resume",
          runId: currentStreamId,
          stream: existingRun.getReadable(),
        };
      }
    } catch {
      // Run not found / inaccessible — fall through to clear the stale id.
    }

    const cleared = await compareAndSetChatActiveStreamId(chatId, currentStreamId, null);
    if (cleared) {
      return { action: "ready" };
    }

    const rows = await selectChats({ id: chatId });
    currentStreamId = rows[0]?.active_stream_id ?? null;
  }

  return currentStreamId ? { action: "conflict" } : { action: "ready" };
}
