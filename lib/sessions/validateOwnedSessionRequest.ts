import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

export interface ValidatedOwnedSessionRequest {
  auth: AuthContext;
  session: Tables<"sessions">;
}

/**
 * Validates a session-scoped request end-to-end:
 *   1. Authenticates via Privy Bearer / x-api-key
 *   2. Loads the session row at the given id
 *   3. Confirms the authenticated account owns it
 *
 * Returns either a 401/403/404 NextResponse describing the first
 * failure, or the resolved `{ auth, session }` for the handler.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the session to gate access on.
 * @returns A NextResponse on failure, or the validated auth + session row.
 */
export async function validateOwnedSessionRequest(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse | ValidatedOwnedSessionRequest> {
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

  return { auth, session };
}
