import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";
import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { kickSandboxLifecycleWorkflow } from "@/lib/sandbox/kickSandboxLifecycleWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";

/**
 * Handles `GET /api/sandbox/status`. Returns the current lifecycle and
 * runtime state for the sandbox bound to a session — DB-only read, no
 * upstream probe. Status is `"active"` when the session row carries a
 * non-expired `sandbox_state` (with real runtime metadata), otherwise
 * `"no_sandbox"`. `hasSnapshot` is true when the row records a saved
 * snapshot the UI can offer to resume.
 *
 * Side-effect: when the row reports `lifecycle_state: "active"` but
 * the lifecycle is past due (workflow never woke or its lease died),
 * fires a `status-check-overdue` lifecycle kick. The kick reclaims
 * stale leases and starts a fresh workflow run — that's how the
 * lifecycle FSM self-heals from crashed workflows.
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

  const active = isSandboxActive(row);

  if (active && row.lifecycle_state === "active" && Date.now() >= getLifecycleDueAtMs(row)) {
    kickSandboxLifecycleWorkflow({ sessionId: row.id, reason: "status-check-overdue" });
  }

  return NextResponse.json(
    {
      status: active ? "active" : "no_sandbox",
      hasSnapshot: !!row.snapshot_url,
      lifecycleVersion: row.lifecycle_version,
      lifecycle: buildLifecycle(row),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
