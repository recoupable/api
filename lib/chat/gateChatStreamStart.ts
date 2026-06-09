import type { NextResponse } from "next/server";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * Gates a new POST start against an existing `chats.active_stream_id`.
 *
 * Resume is GET-only (GET /api/chat/[chatId]/stream); POST never resumes — so
 * when a stream id is already present we reconcile it and translate the outcome
 * into the correct recovery response for the client:
 *
 *   - "resume":   a run is genuinely live → 409, tell the client to reconnect
 *                 via the GET resume endpoint.
 *   - "conflict": stream state is indeterminate (probe failed / stale id not
 *                 cleared) → 503, tell the client to retry the POST shortly.
 *                 (A 409 here would be a dead-end: GET returns 204 for this
 *                 state, so the message would be lost with no retry path.)
 *   - "ready":    a terminal stale id was cleared → return null so the caller
 *                 falls through and starts a fresh run.
 *
 * A null/unset `activeStreamId` short-circuits to null without probing.
 *
 * @param chatId - The chat whose active stream is being gated.
 * @param activeStreamId - The chat's current `active_stream_id` (null when unset).
 * @returns A short-circuit NextResponse (409/503), or null to proceed with start.
 */
export async function gateChatStreamStart(
  chatId: string,
  activeStreamId: string | null,
): Promise<NextResponse | null> {
  if (!activeStreamId) return null;

  const reconciled = await reconcileExistingActiveStream(chatId, activeStreamId);

  if (reconciled.action === "resume") {
    return errorResponse(
      "A response is already streaming for this chat; reconnect via GET /api/chat/{chatId}/stream",
      409,
    );
  }

  if (reconciled.action === "conflict") {
    return errorResponse(
      "Stream state is temporarily unresolved for this chat; retry shortly",
      503,
    );
  }

  return null;
}
