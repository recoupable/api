import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePatchSessionBody } from "@/lib/sessions/validatePatchSessionBody";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { toSessionResponse } from "@/lib/sessions/toSessionResponse";

/**
 * Handles PATCH /api/sessions/{sessionId}.
 *
 * Updates a session's `title` (rename) or `status` (archive/unarchive).
 * All fields are optional; omitted fields are left unchanged.
 * Authenticates via Privy Bearer token or x-api-key header.
 * Returns 404 if the session does not exist and 403 if it exists but
 * is not owned by the authenticated account.
 *
 * @param request - The incoming request.
 * @param sessionId - The id of the session to update.
 * @returns A NextResponse with `{ session }` on 200, or an error.
 */
export async function patchSessionByIdHandler(
  request: NextRequest,
  sessionId: string,
): Promise<NextResponse> {
  const validated = await validatePatchSessionBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { body, auth } = validated;

  const rows = await selectSessions({ id: sessionId });
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

  const updated = await updateSession(sessionId, {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.status !== undefined && { status: body.status }),
  });

  if (!updated) {
    return NextResponse.json(
      { status: "error", error: "Failed to update session" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { session: toSessionResponse(updated) },
    { status: 200, headers: getCorsHeaders() },
  );
}
