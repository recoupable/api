import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";
import { connectSandbox } from "@/lib/sandbox/factory";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { noSandboxResponse } from "@/lib/sandbox/noSandboxResponse";
import { validateSandboxReconnectRequest } from "@/lib/sandbox/validateSandboxReconnectRequest";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { SandboxState } from "@/lib/sandbox/factory";

const PROBE_TIMEOUT_MS = 15_000;

interface ReconnectBody {
  status: "connected" | "expired";
  hasSnapshot: boolean;
  expiresAt?: number;
  lifecycle: ReturnType<typeof buildLifecycle>;
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
  const validated = await validateSandboxReconnectRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { row } = validated;

  if (!hasRuntimeSandboxState(row.sandbox_state)) {
    return noSandboxResponse(row);
  }

  try {
    // Safe cast: hasRuntimeSandboxState above narrowed sandbox_state to an
    // object with a non-empty `sandboxName` — but the Json type is wider, so
    // TS needs the unknown bridge to accept the conversion.
    const sandbox = await connectSandbox(row.sandbox_state as unknown as SandboxState);
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
    console.warn(`[getSandboxReconnectHandler] probe failed for ${row.id}: ${message}`);

    await updateSession(row.id, {
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
