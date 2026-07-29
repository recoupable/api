import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { validateGetChatStreamRequest } from "@/lib/chat/validateGetChatStreamRequest";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { wrapWorkflowStreamWatcher } from "@/lib/chat/wrapWorkflowStreamWatcher";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/chat/[chatId]/stream — the resume/reconnect path.
 *
 * Reattaches the client to an in-flight workflow run for the chat. This is
 * the ONLY way to resume; POST /api/chat/workflow never resumes.
 *
 *   - No active stream id on the chat → 204 (nothing to resume).
 *   - Run still running/pending → 200 with the live UIMessage stream.
 *   - Run terminally done → stale id is cleared, 204.
 *   - Indeterminate probe (workflow API error) → 204 WITHOUT clearing the id,
 *     so a later request can resolve it rather than us falsely declaring the
 *     run dead.
 *
 * 204 is the contract the AI SDK's reconnect expects: it maps an empty
 * response to "no active stream" and settles the chat to `ready`.
 *
 * @param request - The incoming GET request (auth headers only).
 * @param chatId - Chat identifier from the route params.
 * @returns A streaming 200 Response, a 204 Response, or a NextResponse error.
 */
/** 204 response signalling "no active stream to resume". */
const noResumeResponse = (): Response =>
  new Response(null, { status: 204, headers: getCorsHeaders() });

export async function handleChatStreamResume(
  request: NextRequest,
  chatId: string,
): Promise<Response> {
  const validated = await validateGetChatStreamRequest(request, chatId);
  if (validated instanceof NextResponse) return validated;

  const { chat } = validated;
  if (!chat.active_stream_id) return noResumeResponse();

  const reconciled = await reconcileExistingActiveStream(chatId, chat.active_stream_id);
  if (reconciled.action !== "resume") return noResumeResponse();

  // Wrap the resume stream so consumer disconnect releases the inner
  // reader (without cancelling the durable run), terminal status closes
  // the SSE cleanly with synthesized tool-output-error chunks for any
  // open tool-calls, and AbortError / late-404 from racing reads is
  // treated as a clean close instead of bubbling a mid-stream error.
  return createUIMessageStreamResponse({
    stream: wrapWorkflowStreamWatcher(
      reconciled.runId,
      reconciled.stream as ReadableStream<UIMessageChunk>,
    ),
    headers: { ...getCorsHeaders(), "x-workflow-run-id": reconciled.runId },
  });
}
