import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

export interface ValidatedSandboxReconnectRequest {
  row: Tables<"sessions">;
  auth: AuthContext;
}

/**
 * Validates a `GET /api/sandbox/reconnect` request end-to-end:
 *   1. Authenticates the caller via Privy Bearer / x-api-key
 *   2. Requires a `sessionId` query parameter
 *   3. Looks up the session row
 *   4. Enforces ownership (the authed account must match `account_id`)
 *
 * Returns either a 4xx NextResponse describing the first failure, or
 * the validated `{ row, auth }` ready for the handler to consume.
 *
 * @param request - The incoming GET request.
 * @returns A NextResponse on validation failure, or the validated row + auth.
 */
export async function validateSandboxReconnectRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedSandboxReconnectRequest> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { status: "error", error: "Missing sessionId" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const rows = (await selectSessions({ id: sessionId })) ?? [];
  const row = rows[0];

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

  return { row, auth };
}
