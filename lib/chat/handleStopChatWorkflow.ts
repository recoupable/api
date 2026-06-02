import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const PENDING_STREAM_PREFIX = "pending-";
/** Cap on how long /stop waits for the workflow to fully tear down before returning. */
const TERMINAL_WAIT_TIMEOUT_MS = 8000;
/** Poll interval while waiting for terminal status. */
const TERMINAL_WAIT_INTERVAL_MS = 100;

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["cancelled", "completed", "failed"]);

/**
 * Block until the workflow run reaches a terminal status (or we time out).
 *
 * The client awaits this POST and only then transitions out of "streaming",
 * so by the time we return, runAgentWorkflow's finally has closed the writable
 * and the SSE has drained — frontend and DB end up with the same content.
 */
async function waitForTerminalRunStatus(runId: string): Promise<void> {
  const startedAt = Date.now();
  const deadline = startedAt + TERMINAL_WAIT_TIMEOUT_MS;
  let pollCount = 0;
  while (Date.now() < deadline) {
    let status: string | undefined;
    let err: string | undefined;
    try {
      status = await getRun(runId).status;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    pollCount += 1;
    const elapsedMs = Date.now() - startedAt;
    console.log("[diag][stop] waitForTerminalRunStatus tick", {
      runId,
      pollCount,
      elapsedMs,
      status,
      err,
    });
    if (status && TERMINAL_STATUSES.has(status)) {
      console.log("[diag][stop] terminal status reached", { runId, pollCount, elapsedMs, status });
      return;
    }
    await new Promise<void>(resolve => setTimeout(resolve, TERMINAL_WAIT_INTERVAL_MS));
  }
  console.log("[diag][stop] waitForTerminalRunStatus TIMEOUT", {
    runId,
    pollCount,
    elapsedMs: Date.now() - startedAt,
  });
}

/** Cancels the workflow streaming for a chat and releases chats.active_stream_id. */
export async function handleStopChatWorkflow(
  request: NextRequest,
  chatId: string,
): Promise<NextResponse> {
  const validated = await validateStopChatWorkflowRequest(request, chatId);
  if (validated instanceof NextResponse) return validated;

  const activeStreamId = validated.chat.active_stream_id;
  if (!activeStreamId) {
    return NextResponse.json(
      { success: true, stopped: false },
      { status: 200, headers: getCorsHeaders() },
    );
  }

  // Only release the slot after the run is confirmed cancelled. A failed cancel
  // means the run may still be live, so keep the slot held and surface the error
  // rather than reporting a false "stopped" and freeing it for a new run.
  if (!activeStreamId.startsWith(PENDING_STREAM_PREFIX)) {
    const cancelStart = Date.now();
    console.log("[diag][stop] cancel() start", { activeStreamId, ts: cancelStart });
    try {
      await getRun(activeStreamId).cancel();
      console.log("[diag][stop] cancel() returned", {
        activeStreamId,
        cancelMs: Date.now() - cancelStart,
      });
    } catch (error) {
      console.error("[handleStopChatWorkflow] run cancel failed:", error);
      return errorResponse("Failed to stop the workflow", 502);
    }

    // Producer-level sync: hold the response until the workflow body has
    // actually finished (terminal status). That guarantees runAgentWorkflow's
    // finally has run closeChatStream(writable), so SSE drains to the client
    // before the client's stop button transitions out of streaming. Without
    // this, the client torn down SSE while the server kept emitting
    // (and persisting) chunks — reload showed more than the user saw.
    await waitForTerminalRunStatus(activeStreamId);
  }

  // Best-effort slot release: the run is already cancelled, so a failed clear is
  // just stale bookkeeping that reconcileExistingActiveStream heals on the next
  // request — don't fail a successful stop over it.
  const released = await compareAndSetChatActiveStreamId(chatId, activeStreamId, null);
  if ("error" in released) {
    console.error(
      "[handleStopChatWorkflow] failed to clear active_stream_id after cancel:",
      released.error,
    );
  }

  return NextResponse.json(
    { success: true, stopped: true },
    { status: 200, headers: getCorsHeaders() },
  );
}
