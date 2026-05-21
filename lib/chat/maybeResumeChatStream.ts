import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Encapsulates the "is there already a workflow for this chat?" branch of
 * the POST /api/chat/workflow handler.
 *
 *   - If `activeStreamId` is unset → returns `null`; handler proceeds with
 *     a fresh workflow.
 *   - If a workflow is alive → returns a streaming `Response` that pipes
 *     the existing run's readable back to the client.
 *   - If the slot is held by a dead/transient/raced run → returns a 409
 *     `Response`.
 *
 * Extracted from the handler so the orchestration stays small and the
 * resume-vs-conflict logic can grow independently.
 */
export async function maybeResumeChatStream(
  chatId: string,
  activeStreamId: string | null,
): Promise<Response | null> {
  if (!activeStreamId) return null;

  const reconciled = await reconcileExistingActiveStream(chatId, activeStreamId);

  if (reconciled.action === "resume") {
    return createUIMessageStreamResponse({
      stream: reconciled.stream as ReadableStream<UIMessageChunk>,
      headers: { ...getCorsHeaders(), "x-workflow-run-id": reconciled.runId },
    });
  }

  if (reconciled.action === "conflict") {
    return errorResponse("Another workflow is already running for this chat", 409);
  }

  return null; // action: "ready" — caller starts a new workflow.
}
