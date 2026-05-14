import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { toSessionResponse } from "@/lib/sessions/toSessionResponse";

/**
 * Handles GET /api/sessions/{sessionId}.
 *
 * Reads a single agent session by id. Authenticates via Privy Bearer
 * token or x-api-key header. Returns 404 if the session does not exist
 * and 403 if it exists but is not owned by the authenticated account.
 *
 * Response shape mirrors open-agents' /api/sessions/[sessionId] so the
 * existing frontend can cut over to api without code changes.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the session to fetch.
 * @returns A NextResponse with `{ session }` on 200, or an error.
 */
export async function getSessionByIdHandler(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const rows = await selectSessions({ id: sessionId });

  if (rows === null) {
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  const row = rows[0] ?? null;

  if (!row) {
    return NextResponse.json(
      { status: "error", error: "Session not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (row.account_id !== auth.accountId) {
    return NextResponse.json(
      { status: "error", error: "Forbidden" },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { session: toSessionResponse(row) },
    { status: 200, headers: getCorsHeaders() },
  );
}
