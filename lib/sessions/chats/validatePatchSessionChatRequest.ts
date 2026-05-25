import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";

const patchSessionChatBodySchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty").optional(),
    modelId: z.string().trim().min(1, "modelId cannot be empty").optional(),
  })
  .strict("Unexpected field in request body")
  .refine(value => value.title !== undefined || value.modelId !== undefined, {
    message: "At least one field is required",
  });

export type PatchSessionChatBody = z.infer<typeof patchSessionChatBodySchema>;

/**
 * Validates a `PATCH /api/sessions/{sessionId}/chats/{chatId}` request
 * end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Loads the session and confirms the caller owns it
 *   3. Loads the chat and confirms it belongs to the session
 *   4. Parses the JSON body and ensures at least one updatable field
 *      is present and non-empty
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @param chatId - The id of the chat being updated.
 * @returns A NextResponse on failure, or the validated patch body on success.
 */
export async function validatePatchSessionChatRequest(
  request: NextRequest,
  sessionId: string,
  chatId: string,
): Promise<NextResponse | PatchSessionChatBody> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const sessionRows = await selectSessions({ id: sessionId });
  const session = sessionRows[0] ?? null;

  if (!session) {
    return NextResponse.json(
      { status: "error", error: "Session not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (session.account_id !== auth.accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  const chatRows = await selectChats({ id: chatId });
  const chat = chatRows[0] ?? null;

  if (!chat || chat.session_id !== sessionId) {
    return NextResponse.json(
      { status: "error", error: "Chat not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const parsed = patchSessionChatBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return parsed.data;
}
