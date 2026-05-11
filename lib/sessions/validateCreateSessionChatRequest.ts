import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateOwnedSessionRequest } from "@/lib/sessions/validateOwnedSessionRequest";
import type { ValidatedOwnedSessionRequest } from "@/lib/sessions/validateOwnedSessionRequest";

export const createSessionChatBodySchema = z.object({
  id: z.string({ error: "Invalid chat id" }).min(1, "Invalid chat id").optional(),
});

export type CreateSessionChatBody = z.infer<typeof createSessionChatBodySchema>;

export interface ValidatedCreateSessionChatRequest extends ValidatedOwnedSessionRequest {
  body: CreateSessionChatBody;
}

/**
 * Validates a `POST /api/sessions/{sessionId}/chats` request end-to-end:
 *   1. Authenticates the caller and verifies they own the session
 *      (via `validateOwnedSessionRequest`)
 *   2. Parses the JSON body (malformed JSON is treated as empty)
 *   3. Validates the optional `{ id }` field
 *
 * An explicitly empty or non-string id is rejected with the same 400
 * shape open-agents used (`{ error: "Invalid chat id" }`) for parity.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the parent session.
 * @returns A NextResponse on failure, or the validated auth + session + body.
 */
export async function validateCreateSessionChatRequest(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse | ValidatedCreateSessionChatRequest> {
  const owned = await validateOwnedSessionRequest(request, sessionId);
  if (owned instanceof NextResponse) {
    return owned;
  }

  const rawBody = await safeParseJson(request);
  const candidate =
    rawBody && typeof rawBody === "object" && !Array.isArray(rawBody) ? rawBody : {};

  const result = createSessionChatBodySchema.safeParse(candidate);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid chat id" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return { auth: owned.auth, session: owned.session, body: result.data };
}
