import { getRun } from "workflow/api";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";

export type ReconcileResult =
  | { action: "resume"; runId: string }
  | { action: "ready" }
  | { action: "conflict" };

const RUNNING_STATUSES = new Set(["running", "pending"]);
const TERMINAL_STATUSES = new Set(["completed", "cancelled", "failed"]);

/**
 * Resolves what to do when `chats.active_stream_id` is already set at the
 * start of a new chat-workflow request.
 *
 *   - If the referenced workflow run is alive (`running` | `pending`) →
 *     `action: "resume"`. The caller rejects the new POST and directs the
 *     client to the GET resume endpoint. No reader is opened here.
 *   - If the run is terminally done AND we win the CAS to clear the stale id
 *     → `action: "ready"`. Caller starts a fresh workflow.
 *   - **Anything else** (workflow API throws, CAS-clear loses the race, CAS
 *     reports a DB error) → `action: "conflict"`. Surfaces as retryable 503 upstream.
 *
 * Safer-than-open-agents error semantics: a transient `workflow/api` failure
 * does NOT clear the stale stream id (which previously created a window for
 * duplicate runs). When we can't confidently say "this stream is dead", we
 * refuse to start a new one. Eventually the real run completes, a subsequent
 * request observes that, clears the slot, and unblocks.
 */
export async function reconcileExistingActiveStream(
  chatId: string,
  activeStreamId: string,
): Promise<ReconcileResult> {
  // A reservation is not a workflow id and cannot be safely cleared or resumed.
  if (activeStreamId.startsWith("pending-")) return { action: "conflict" };

  // Probe the workflow status. Any thrown error here is treated as transient —
  // we keep the slot held rather than risk starting a duplicate run.
  let status: string;
  try {
    const existingRun = getRun(activeStreamId);
    status = await existingRun.status;
    if (RUNNING_STATUSES.has(status)) {
      return { action: "resume", runId: activeStreamId };
    }
  } catch (error) {
    console.error("[reconcileExistingActiveStream] getRun failed; treating as conflict:", error);
    return { action: "conflict" };
  }

  if (!TERMINAL_STATUSES.has(status)) return { action: "conflict" };

  // Run is terminally done. Attempt to clear the stale id via CAS. If we
  // win → ready. Anything else (race lost OR DB error) → conflict, so we
  // never accidentally start a duplicate workflow on the back of a failed
  // read.
  const cleared = await compareAndSetChatActiveStreamId(chatId, activeStreamId, null);
  if (cleared.ok && cleared.claimed) {
    return { action: "ready" };
  }
  return { action: "conflict" };
}
