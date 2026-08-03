import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { getRun } from "workflow/api";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { parseStreamStartIndex } from "@/lib/chat/parseStreamStartIndex";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { wrapWorkflowStreamWatcher } from "@/lib/chat/wrapWorkflowStreamWatcher";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const TERMINAL_RUN_STATUSES: ReadonlySet<string> = new Set(["completed", "cancelled", "failed"]);

/**
 * Handles `GET /api/chat/{chatId}/stream` — reconnect to an in-progress
 * chat response.
 *
 * A long turn's SSE stream can end before the run does, which leaves the
 * client rendering a half-finished message with no way back in: `POST
 * /api/chat` resumes only as a side effect of starting a turn, so today
 * recovery needs a full page load (chat#1923). This is the resume path,
 * and `startIndex` is what makes it gap-free.
 *
 * Contract (docs#286): 200 SSE + `x-workflow-run-id`, 204 when there is
 * nothing to resume, 400 malformed `startIndex`, 401/403/404 from auth
 * and ownership.
 *
 * @param request - The incoming request.
 * @param chatId - Chat id from the route params.
 * @returns The resumed stream, 204, or an error response.
 */
export async function handleResumeChatStream(
  request: NextRequest,
  chatId: string,
): Promise<Response> {
  const validated = await validateChatOwnership(request, chatId);
  if (validated instanceof NextResponse) return validated;

  const startIndex = parseStreamStartIndex(new URL(request.url));
  if (startIndex instanceof NextResponse) return startIndex;

  const activeStreamId = validated.chat.active_stream_id;
  if (!activeStreamId) return new NextResponse(null, { status: 204, headers: getCorsHeaders() });

  const run = getRun(activeStreamId);

  // A failed status read must not be reported as "nothing to resume" — that
  // tells a client with a live run to stop reconnecting, which is the exact
  // silent-truncation this endpoint exists to prevent. Surface it instead so
  // the client retries. Mirrors reconcileExistingActiveStream, which treats a
  // transient workflow-api failure as conflict rather than clearing the slot.
  let status: string;
  try {
    status = await run.status;
  } catch (error) {
    console.error("[handleResumeChatStream] run status lookup failed:", error);
    return errorResponse("Failed to read the workflow run", 502);
  }

  if (TERMINAL_RUN_STATUSES.has(status)) {
    // The run is done, so the slot is stale bookkeeping. Best-effort clear:
    // a failed CAS just leaves it for the next request to heal.
    const cleared = await compareAndSetChatActiveStreamId(chatId, activeStreamId, null);
    if ("error" in cleared) {
      console.error("[handleResumeChatStream] failed to clear stale active_stream_id:", cleared);
    }
    return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
  }

  const readable = run.getReadable<UIMessageChunk>({ startIndex });

  // Tell the client where this read ends so its next reconnect can resume
  // exactly there instead of replaying from chunk zero. Upstream open-agents
  // returns the same header, and the SDK's WorkflowChatTransport reads it to
  // compute absolute chunk positions. Best-effort: if the runtime can't report
  // a tail index we still stream — a replaying client beats no client.
  let tailIndex: number | undefined;
  try {
    tailIndex = await readable.getTailIndex();
  } catch (error) {
    console.error("[handleResumeChatStream] getTailIndex failed:", error);
  }

  return createUIMessageStreamResponse({
    stream: wrapWorkflowStreamWatcher(activeStreamId, readable),
    headers: {
      ...getCorsHeaders(),
      "x-workflow-run-id": activeStreamId,
      ...(tailIndex === undefined ? {} : { "x-workflow-stream-tail-index": String(tailIndex) }),
    },
  });
}
