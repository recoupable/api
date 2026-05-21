import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateChatWorkflowBody } from "@/lib/chat/validateChatWorkflowBody";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import generateUUID from "@/lib/uuid/generateUUID";

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ status: "error", error }, { status, headers: getCorsHeaders() });
}

/**
 * Handles POST /api/chat/workflow.
 *
 * Stub implementation: authenticates the caller, validates the body, verifies
 * ownership of the referenced session + chat, confirms the session's sandbox is
 * active, then returns a hardcoded UIMessage stream with an `x-workflow-run-id`
 * header. The Vercel Workflow that will eventually drive the agent loop is wired
 * up in a follow-up PR — this stub exists so clients can integrate against the
 * contract documented at /api-reference/chat/workflow.
 *
 * @param request - The incoming NextRequest
 * @returns A streaming Response (200) or a NextResponse error.
 */
export async function handleChatWorkflowStream(request: NextRequest): Promise<Response> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const validated = validateChatWorkflowBody(rawBody);
  if (validated instanceof NextResponse) return validated;

  const sessions = await selectSessions({ id: validated.sessionId });
  if (sessions === null) return errorResponse("Internal server error", 500);
  const session = sessions[0];
  if (!session) return errorResponse("Session not found", 404);
  if (session.account_id !== auth.accountId) return errorResponse("Forbidden", 403);
  if (!isSandboxActive(session)) return errorResponse("Sandbox not initialized", 400);

  const chats = await selectChats({ id: validated.chatId });
  const chat = chats[0];
  if (!chat || chat.session_id !== validated.sessionId) {
    return errorResponse("Chat not found", 404);
  }

  const runId = `stub-${generateUUID()}`;

  const stream = createUIMessageStream({
    generateId: generateUUID,
    execute: ({ writer }) => {
      const id = generateUUID();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: "Hello from /api/chat/workflow" });
      writer.write({ type: "text-end", id });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      ...getCorsHeaders(),
      "x-workflow-run-id": runId,
    },
  });
}
