import { NextRequest, NextResponse, after } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";
import { getLifecycleDueAtMs } from "@/lib/sandbox/getLifecycleDueAtMs";
import { getSandboxExpiresAtDate } from "@/lib/sandbox/getSandboxExpiresAtDate";
import { getResumableSandboxName } from "@/lib/sandbox/getResumableSandboxName";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { kickSandboxLifecycleWorkflow } from "@/lib/sandbox/kickSandboxLifecycleWorkflow";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";

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

  const active = isSandboxActive(row);

  // Self-heal: a previous lifecycle evaluation may have set state to
  // `failed` while the runtime sandbox is still alive. Recover so the
  // UI doesn't get stuck on "Paused" — refresh `sandbox_expires_at`
  // from the persisted state at the same time.
  let effectiveRow = row;
  if (active && row.lifecycle_state === "failed") {
    const recovered = await updateSession(row.id, {
      lifecycle_state: "active",
      lifecycle_error: null,
      sandbox_expires_at: getSandboxExpiresAtDate(row.sandbox_state),
    });
    if (recovered) effectiveRow = recovered;
  }

  if (
    active &&
    effectiveRow.lifecycle_state === "active" &&
    Date.now() >= getLifecycleDueAtMs(effectiveRow)
  ) {
    kickSandboxLifecycleWorkflow({
      sessionId: effectiveRow.id,
      reason: "status-check-overdue",
      scheduleBackgroundWork: task => after(() => task),
    });
  }

  // `hasSnapshot` is true when there's any way back to this sandbox:
  // a saved snapshot URL, OR a hibernated session that still has a
  // resumable name in `sandbox_state`. The lifecycle FSM is the
  // source of truth for "is this sandbox paused" — the row-level
  // `sandbox_expires_at` alone can't disambiguate hibernated from
  // freshly-provisioned-but-not-yet-expiry-stamped.
  const isResumable = getResumableSandboxName(effectiveRow.sandbox_state) !== null;
  const isHibernated = effectiveRow.lifecycle_state === "hibernated";
  const hasSnapshot = !!effectiveRow.snapshot_url || (isResumable && isHibernated);

  return NextResponse.json(
    {
      status: active ? "active" : "no_sandbox",
      hasSnapshot,
      lifecycleVersion: effectiveRow.lifecycle_version,
      lifecycle: buildLifecycle(effectiveRow),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
