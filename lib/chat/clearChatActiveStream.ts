import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { delay } from "@/lib/time/delay";

const MAX_ATTEMPTS = 3;
// 50ms picked to match open-agents' `ACTIVE_STREAM_CLEAR_RETRY_DELAY_MS`
// — a transient Supabase blip costs at most ~150ms total before the
// third attempt, keeping the cleanup tail well under the human-
// perceptible ~250ms threshold.
const RETRY_DELAY_MS = 50;

/**
 * Vercel Workflow `"use step"` that CAS-clears `chats.active_stream_id`
 * back to null **only if** it still holds this workflow run's id.
 *
 * Designed to be called from the end of `runAgentWorkflow`'s body so it
 * fires the moment the durable run finishes — no `after()` / polling
 * lag. Mirrors open-agents' `clearActiveStream` step in
 * `app/workflows/chat-post-finish.ts`.
 *
 * Why CAS instead of unconditional UPDATE: if a newer run has already
 * claimed the slot (e.g. the user submitted a follow-up while this
 * run was draining cleanup), the newer run's id is preserved.
 *
 * Retries up to 3 times with a short delay so a transient Supabase
 * failure here doesn't leave the chat permanently stuck as
 * "isStreaming: true". Final-attempt failures are logged but never
 * thrown — the workflow has already done its real work; we don't want
 * a cleanup hiccup to mark the run as failed.
 *
 * @param chatId - Target chat row.
 * @param workflowRunId - The current run's id (from
 *   `getWorkflowMetadata().workflowRunId`).
 */
export async function clearChatActiveStream(chatId: string, workflowRunId: string): Promise<void> {
  "use step";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await compareAndSetChatActiveStreamId(chatId, workflowRunId, null);
      if (result.ok === false) {
        if (attempt === MAX_ATTEMPTS) {
          console.error(
            `[clearChatActiveStream] CAS error chatId=${chatId} runId=${workflowRunId}: ${result.error}`,
          );
          return;
        }
        await delay(RETRY_DELAY_MS);
        continue;
      }
      // result.ok === true. result.claimed === false means the race was lost
      // (a newer run owns the slot) — nothing to do, just return.
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(
          `[clearChatActiveStream] unhandled error chatId=${chatId} runId=${workflowRunId}:`,
          error,
        );
        return;
      }
      await delay(RETRY_DELAY_MS);
    }
  }
}
