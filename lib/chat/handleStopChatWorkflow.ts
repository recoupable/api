import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { waitForTerminalRunStatus } from "@/lib/chat/waitForTerminalRunStatus";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const PENDING_STREAM_PREFIX = "pending-";

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
    const reachedTerminal = await waitForTerminalRunStatus(activeStreamId);
    if (!reachedTerminal) {
      // Run still appears live after the wait deadline — refuse to release
      // the slot so a follow-up POST can retry cancellation rather than
      // having a slot-clearing race against a still-streaming workflow.
      return errorResponse("Workflow did not terminate in time", 504);
    }
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
