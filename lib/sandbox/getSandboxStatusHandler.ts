import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";

/**
 * Handles `GET /api/sandbox/status`. Returns the current lifecycle and
 * runtime state for the sandbox bound to a session — DB-only read, no
 * upstream probe. Status is `"active"` when the session row carries a
 * non-expired `sandbox_state` (with real runtime metadata), otherwise
 * `"no_sandbox"`. `hasSnapshot` is true when the row records a saved
 * snapshot the UI can offer to resume.
 */
export async function getSandboxStatusHandler(request: NextRequest): Promise<NextResponse> {
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

  const rows = await selectSessions({ id: sessionId });
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

  return NextResponse.json(
    {
      status: isSandboxActive(row) ? "active" : "no_sandbox",
      hasSnapshot: !!row.snapshot_url,
      lifecycleVersion: row.lifecycle_version,
      lifecycle: buildLifecycle(row),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
