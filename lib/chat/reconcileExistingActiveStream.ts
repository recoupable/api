import { updateChat } from "@/lib/supabase/chats/updateChat";

export type ReconcileResult =
  | { action: "resume"; runId: string; stream: ReadableStream<unknown> }
  | { action: "ready" }
  | { action: "conflict" };

const RUNNING_STATUSES = new Set(["running", "pending"]);

/**
 * Resolves what to do when `chats.active_stream_id` is already set at the
 * start of a new chat-workflow request.
 *
 *   - If the referenced workflow run is alive (`running` | `pending`) →
 *     `action: "resume"` with the existing readable. Caller pipes it back to
 *     the client.
 *   - If the run is terminally done AND we win the CAS to clear the stale id
 *     → `action: "ready"`. Caller starts a fresh workflow.
 *   - **Anything else** (workflow API throws, CAS-clear loses the race, CAS
 *     reports a DB error) → `action: "conflict"`. Surfaces as 409 upstream.
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
  const { getRun } = await import("workflow/api");

  // Probe the workflow status. Any thrown error here is treated as transient —
  // we keep the slot held rather than risk starting a duplicate run.
  let status: string;
  try {
    const existingRun = getRun(activeStreamId);
    status = await existingRun.status;
    if (RUNNING_STATUSES.has(status)) {
      return { action: "resume", runId: activeStreamId, stream: existingRun.getReadable() };
    }
  } catch (error) {
    console.error("[reconcileExistingActiveStream] getRun failed; treating as conflict:", error);
    return { action: "conflict" };
  }

  // Run is terminally done. Attempt to claim the slot for the new request by
  // CASing the stale id back to null. If we win → ready. Anything else
  // (race lost OR DB error) → conflict, so we never accidentally start a
  // duplicate workflow on the back of a failed read.
  const cleared = await updateChat(
    { id: chatId, whereActiveStreamId: { equals: activeStreamId } },
    { active_stream_id: null },
  );

  if (cleared.ok && cleared.rowsUpdated > 0) {
    return { action: "ready" };
  }

  return { action: "conflict" };
}
