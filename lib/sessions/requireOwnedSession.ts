import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

export interface OwnedSessionContext {
  auth: AuthContext;
  session: Tables<"sessions">;
}

/**
 * Authenticates the caller and verifies they own the session at the
 * given id. Mirrors the `validateAuthContext` return convention so
 * callers can early-return on the `NextResponse` branch and keep
 * working with `{ auth, session }` otherwise.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the session to gate access on.
 * @returns A 401/403/404 NextResponse on failure, or the resolved auth + session row.
 */
export async function requireOwnedSession(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse | OwnedSessionContext> {
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
