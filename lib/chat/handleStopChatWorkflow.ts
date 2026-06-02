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

/** Block until the run reaches a terminal status (cancelled/completed/failed) or we time out. */
async function waitForTerminalRunStatus(runId: string): Promise<void> {
  const deadline = Date.now() + TERMINAL_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const status = await getRun(runId).status;
      if (TERMINAL_STATUSES.has(status)) return;
    } catch {
      // Transient errors: swallow and retry until the deadline.
    }
    await new Promise<void>(resolve => setTimeout(resolve, TERMINAL_WAIT_INTERVAL_MS));
  }
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
    try {
      await getRun(activeStreamId).cancel();
    } catch (error) {
      console.error("[handleStopChatWorkflow] run cancel failed:", error);
      return errorResponse("Failed to stop the workflow", 502);
    }

    // Hold the response until the workflow tears down so the client's await
    // resolves after SSE drains — keeps frontend and DB in sync on stop.
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
