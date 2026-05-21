import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { validatePatchSessionBody } from "@/lib/sessions/validatePatchSessionBody";
import { stopSandboxOnArchive } from "@/lib/sessions/stopSandboxOnArchive";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { toSessionResponse } from "@/lib/sessions/toSessionResponse";

/**
 * Handles PATCH /api/sessions/{sessionId}.
 *
 * Updates a session's `title`, `status` (see DB CHECK / public docs:
 * `running`, `completed`, `failed`, `archived`), and optional
 * `linesAdded` / `linesRemoved` counters. All fields are optional;
 * omitted fields are left unchanged.
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

  const shouldArchive = body.status === "archived" && row.status !== "archived";
  const shouldUnarchive = body.status === "running" && row.status === "archived";

  const isSandboxPausing =
    hasRuntimeSandboxState(row.sandbox_state) &&
    row.lifecycle_state !== "hibernated" &&
    row.lifecycle_state !== "archived";

  if (shouldUnarchive && !row.snapshot_url && isSandboxPausing) {
    return NextResponse.json(
      { status: "error", error: "Sandbox is still being paused, try again in a few seconds." },
      { status: 409, headers: getCorsHeaders() },
    );
  }

  const updates = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.linesAdded !== undefined && { lines_added: body.linesAdded }),
    ...(body.linesRemoved !== undefined && { lines_removed: body.linesRemoved }),
    ...(shouldUnarchive && { lifecycle_state: null, lifecycle_error: null }),
  };

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { session: toSessionResponse(row) },
      { status: 200, headers: getCorsHeaders() },
    );
  }

  const updated = await updateSession(sessionId, updates);

  if (!updated) {
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  if (shouldArchive) {
    after(() => stopSandboxOnArchive(row));
  }

  return NextResponse.json(
    { session: toSessionResponse(updated) },
    { status: 200, headers: getCorsHeaders() },
  );
}
