import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { start, getRun } from "workflow/api";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { buildActiveLifecycleUpdate } from "@/lib/sandbox/buildActiveLifecycleUpdate";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { compareAndSetChatActiveStreamId } from "@/lib/supabase/chats/compareAndSetChatActiveStreamId";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { persistLatestUserMessage } from "@/lib/chat/persistLatestUserMessage";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { runAgentWorkflow } from "@/app/workflows/runAgentWorkflow";

const DEFAULT_MODEL_ID = "anthropic/claude-haiku-4.5";

/**
 * Handles POST /api/chat/workflow.
 *
 * Wires the chat UI to a durable Vercel Workflow agent loop:
 *
 *   1. Validate auth + body (validateChatWorkflow).
 *   2. Verify session + chat ownership; ensure the session has an active sandbox.
 *   3. If a workflow is already running for this chat, resume its stream
 *      (or 409 on irresolvable conflict).
 *   4. Refresh the session's lifecycle-activity timestamp so the sandbox
 *      lifecycle watcher doesn't hibernate mid-stream.
 *   5. Fire-and-forget persist the latest user message so a refresh shows it.
 *   6. start(runAgentWorkflow) → CAS the run id into chats.active_stream_id.
 *      If the CAS loses to a race, cancel our run and 409.
 *   7. Return the workflow's UIMessage stream with x-workflow-run-id header.
 *
 * Tools/sandbox passing is intentionally not wired here yet — the follow-up
 * PR ports the @open-harness/agent tool surface into api and threads them
 * through runAgentStep via experimental_context.
 *
 * @param request - The incoming NextRequest.
 * @returns A streaming 200 Response or a NextResponse error.
 */
export async function handleChatWorkflowStream(request: NextRequest): Promise<Response> {
  const validated = await validateChatWorkflow(request);
  if (validated instanceof NextResponse) return validated;

  // Session + ownership + sandbox active
  const sessions = await selectSessions({ id: validated.sessionId });
  if (sessions === null) return errorResponse("Internal server error", 500);
  const session = sessions[0];
  if (!session) return errorResponse("Session not found", 404);
  if (session.account_id !== validated.accountId) return errorResponse("Forbidden", 403);
  if (!isSandboxActive(session)) return errorResponse("Sandbox not initialized", 400);

  // Chat + ownership
  const chats = await selectChats({ id: validated.chatId });
  const chat = chats[0];
  if (!chat || chat.session_id !== validated.sessionId) {
    return errorResponse("Chat not found", 404);
  }

  // Resume an in-flight workflow for this chat (or 409) before starting a new one.
  if (chat.active_stream_id) {
    const reconciled = await reconcileExistingActiveStream(validated.chatId, chat.active_stream_id);
    if (reconciled.action === "resume") {
      return createUIMessageStreamResponse({
        stream: reconciled.stream as ReadableStream<UIMessageChunk>,
        headers: { ...getCorsHeaders(), "x-workflow-run-id": reconciled.runId },
      });
    }
    if (reconciled.action === "conflict") {
      return errorResponse("Another workflow is already running for this chat", 409);
    }
  }

  // Refresh lifecycle activity so long-running responses don't look idle.
  await updateSession(validated.sessionId, buildActiveLifecycleUpdate(session.sandbox_state));

  // Persist latest user message in the background — never block the stream on this.
  void persistLatestUserMessage(validated.chatId, validated.messages as never);

  // Resolve the model: explicit body wins → chat row → platform default.
  const modelId = chat.model_id ?? DEFAULT_MODEL_ID;

  const run = await start(runAgentWorkflow, [
    {
      messages: validated.messages,
      chatId: validated.chatId,
      sessionId: validated.sessionId,
      modelId,
    },
  ]);

  // Atomically claim the activeStreamId slot. If another request raced us, cancel + 409.
  const claimed = await compareAndSetChatActiveStreamId(validated.chatId, null, run.runId);
  if (!claimed) {
    try {
      getRun(run.runId).cancel();
    } catch {
      // best-effort cleanup
    }
    return errorResponse("Another workflow is already running for this chat", 409);
  }

  return createUIMessageStreamResponse({
    stream: run.getReadable<UIMessageChunk>(),
    headers: { ...getCorsHeaders(), "x-workflow-run-id": run.runId },
  });
}
