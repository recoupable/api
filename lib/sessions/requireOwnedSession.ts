import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

export type RequireOwnedSessionResult =
  | {
      ok: true;
      auth: AuthContext;
      session: Tables<"sessions">;
    }
  | {
      ok: false;
      response: NextResponse;
    };

/**
 * Authenticates the caller and verifies they own the session at the
 * given id. Returns a discriminated union so callers can either bail
 * with the prepared `NextResponse` or keep going with the resolved
 * `{ auth, session }` pair.
 *
 * Mirrors open-agents' `requireOwnedSession` so behaviour stays aligned
 * across routes that gate on session ownership.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the session to gate access on.
 * @returns Either an `ok: true` carrier with auth + row, or an `ok: false` carrier with a 401/403/404 NextResponse.
 */
export async function requireOwnedSession(
  request: NextRequest,
  sessionId: string,
): Promise<RequireOwnedSessionResult> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return { ok: false, response: auth };
  }

  const rows = await selectSessions({ id: sessionId });
  const session = rows[0] ?? null;

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", error: "Session not found" },
        { status: 404, headers: getCorsHeaders() },
      ),
    };
  }

  if (session.account_id !== auth.accountId) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", error: "Forbidden" },
        { status: 403, headers: getCorsHeaders() },
      ),
    };
  }

  return { ok: true, auth, session };
}
