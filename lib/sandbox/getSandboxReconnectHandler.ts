import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";
import { connectSandbox } from "@/lib/sandbox/factory";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { SandboxState } from "@/lib/sandbox/factory";
import type { Tables } from "@/types/database.types";

const PROBE_TIMEOUT_MS = 15_000;

interface ReconnectBody {
  status: "connected" | "expired" | "no_sandbox";
  hasSnapshot: boolean;
  expiresAt?: number;
  lifecycle: ReturnType<typeof buildLifecycle>;
}

function noSandboxResponse(row: Tables<"sessions">): NextResponse {
  const body: ReconnectBody = {
    status: "no_sandbox",
    hasSnapshot: !!row.snapshot_url,
    lifecycle: buildLifecycle(row),
  };
  return NextResponse.json(body, { status: 200, headers: getCorsHeaders() });
}

/**
 * Handles `GET /api/sandbox/reconnect`. Live runtime probe — actually
 * runs a quick command inside the sandbox to verify it is reachable.
 * The chat UI calls this on session re-entry / tab refocus to decide
 * whether the sandbox can be resumed (`connected`), needs to be
 * recreated from a snapshot (`expired`), or has never existed
 * (`no_sandbox`).
 *
 * On `expired`, runtime state is cleared on the session row and
 * lifecycle is set to `hibernated` so subsequent reads via
 * `GET /api/sandbox/status` agree with the probe.
 */
export async function getSandboxReconnectHandler(request: NextRequest): Promise<NextResponse> {
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

  if (!hasRuntimeSandboxState(row.sandbox_state)) {
    return noSandboxResponse(row);
  }

  try {
    const sandbox = await connectSandbox(row.sandbox_state as SandboxState);
    await sandbox.exec("pwd", sandbox.workingDirectory, PROBE_TIMEOUT_MS);

    const body: ReconnectBody = {
      status: "connected",
      hasSnapshot: !!row.snapshot_url,
      expiresAt: sandbox.expiresAt,
      lifecycle: buildLifecycle(row),
    };
    return NextResponse.json(body, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[getSandboxReconnectHandler] probe failed for ${sessionId}: ${message}`);

    await updateSession(sessionId, {
      sandbox_state: null,
      lifecycle_state: "hibernated",
      sandbox_expires_at: null,
      hibernate_after: null,
    });

    const body: ReconnectBody = {
      status: "expired",
      hasSnapshot: !!row.snapshot_url,
      lifecycle: {
        serverTime: Date.now(),
        state: "hibernated",
        lastActivityAt: null,
        hibernateAfter: null,
        sandboxExpiresAt: null,
      },
    };
    return NextResponse.json(body, { status: 200, headers: getCorsHeaders() });
  }
}
