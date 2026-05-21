import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const PENDING_STREAM_PREFIX = "pending-";

/**
 * Handles POST /api/chat/{chatId}/stop.
 *
 * Stops the workflow currently streaming for a chat. Flow:
 *   1. Validate auth + chat ownership (validateStopChatWorkflowRequest).
 *   2. Read `chats.active_stream_id`:
 *        - unset            → nothing to stop (200, `stopped: false`).
 *        - real run id      → cancel the Vercel Workflow run, then release
 *                             the slot via CAS.
 *        - `pending-<uuid>` → a `start()` is mid-flight and hasn't promoted
 *                             to a real run id yet. There's no run to cancel,
 *                             but clearing the slot makes the in-flight
 *                             handler's promote-CAS fail — it cancels its own
 *                             run and 409s. So we just release the slot.
 *
 * Releasing is a CAS against the exact id we observed. If the run finished or
 * another request moved the slot between read and release, we still report
 * success — the goal ("no active workflow for this chat") holds either way.
 * A cancel that throws (run already terminal / unknown) is non-fatal.
 *
 * @param request - The incoming NextRequest.
 * @param chatId - The chat id from the route path.
 * @returns A NextResponse: 200 `{ success, stopped }`, or an error.
 */
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

  if (!activeStreamId.startsWith(PENDING_STREAM_PREFIX)) {
    try {
      await getRun(activeStreamId).cancel();
    } catch (error) {
      console.error("[handleStopChatWorkflow] run cancel failed; releasing slot anyway:", error);
    }
  }

  const released = await compareAndSetChatActiveStreamId(chatId, activeStreamId, null);
  if (!released.ok) return errorResponse("Internal server error", 500);

  return NextResponse.json(
    { success: true, stopped: true },
    { status: 200, headers: getCorsHeaders() },
  );
}
