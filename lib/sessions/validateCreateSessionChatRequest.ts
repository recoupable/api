import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

export const createSessionChatBodySchema = z.object({
  id: z.string({ error: "Invalid chat id" }).min(1, "Invalid chat id").optional(),
});

export type CreateSessionChatBody = z.infer<typeof createSessionChatBodySchema>;

export interface ValidatedCreateSessionChatRequest {
  auth: AuthContext;
  session: Tables<"sessions">;
  body: CreateSessionChatBody;
}

/**
 * Validates a `POST /api/sessions/{sessionId}/chats` request end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Loads the session row at the given id
 *   3. Confirms the authenticated account owns it
 *   4. Parses the JSON body (malformed JSON is treated as empty)
 *   5. Validates the optional `{ id }` field
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
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const rows = await selectSessions({ id: sessionId });
  const session = rows[0] ?? null;

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

  return { auth, session, body: result.data };
}
