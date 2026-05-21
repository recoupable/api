import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
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
  }

  const released = await compareAndSetChatActiveStreamId(chatId, activeStreamId, null);
  if (!released.ok) return errorResponse("Internal server error", 500);

  return NextResponse.json(
    { success: true, stopped: true },
    { status: 200, headers: getCorsHeaders() },
  );
}
