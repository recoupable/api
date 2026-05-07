import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import type { Tables } from "@/types/database.types";

const SANDBOX_EXPIRES_BUFFER_MS = 10_000;

function isoToEpochMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function buildLifecycle(row: Tables<"sessions">) {
  return {
    serverTime: Date.now(),
    state: row.lifecycle_state,
    lastActivityAt: isoToEpochMs(row.last_activity_at),
    hibernateAfter: isoToEpochMs(row.hibernate_after),
    sandboxExpiresAt: isoToEpochMs(row.sandbox_expires_at),
  };
}

function isSandboxActive(row: Tables<"sessions">): boolean {
  if (!row.sandbox_state) return false;
  const expiresAt = isoToEpochMs(row.sandbox_expires_at);
  if (expiresAt === null) return true;
  return Date.now() < expiresAt - SANDBOX_EXPIRES_BUFFER_MS;
}

/**
 * Handles `GET /api/sandbox/status`. Returns the current lifecycle and
 * runtime state for the sandbox bound to a session — DB-only read, no
 * upstream probe. Status is `"active"` when the session row carries a
 * non-expired `sandbox_state`, otherwise `"no_sandbox"`. `hasSnapshot`
 * is true when the row records a saved snapshot the UI can offer to
 * resume.
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
