import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * Gates a new POST against the chat's existing workflow slot.
 * A live run requires GET reconnection (409); an indeterminate slot requires
 * retrying the POST (503). Only an empty or safely cleared slot permits start.
 *
 * @param chatId - The chat receiving the new message.
 * @param activeStreamId - The current workflow slot, if set.
 * @returns A recovery response or null when a new workflow may start.
 */
export async function gateChatStreamStart(
  chatId: string,
  activeStreamId: string | null,
): Promise<Response | null> {
  if (!activeStreamId) return null;
  const reconciled = await reconcileExistingActiveStream(chatId, activeStreamId);
  if (reconciled.action === "resume") {
    return errorResponse(
      "A response is already streaming for this chat; reconnect via GET /api/chat/{chatId}/stream before retrying this message",
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
