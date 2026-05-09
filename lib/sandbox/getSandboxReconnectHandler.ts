import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { buildLifecycle } from "@/lib/sandbox/buildLifecycle";
import { clearUnavailableSandboxState } from "@/lib/sandbox/clearUnavailableSandboxState";
import { connectSandbox } from "@/lib/sandbox/factory";
import { getSandboxExpiresAtDate } from "@/lib/sandbox/getSandboxExpiresAtDate";
import { getStateExpiresAt } from "@/lib/sandbox/getStateExpiresAt";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";
import { isSandboxUnavailableError } from "@/lib/sandbox/isSandboxUnavailableError";
import { noSandboxResponse } from "@/lib/sandbox/noSandboxResponse";
import { validateSandboxReconnectRequest } from "@/lib/sandbox/validateSandboxReconnectRequest";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import type { Json } from "@/types/database.types";
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
 * On a successful probe, refreshes `sandbox_expires_at` from the live
 * SDK state, and recovers a stale `lifecycle_state: "failed"` back to
 * `"active"` so the FE timer + status agree with reality.
 *
 * On a probe failure, distinguishes:
 *   - **Permanently unavailable** (404 / 410 / "sandbox not found" /
 *     "sandbox is stopped" / "sandbox probe failed") — clear runtime
 *     metadata via `clearUnavailableSandboxState`, mark hibernated,
 *     return `expired`. Not-found errors also drop the resume handle;
 *     other unavailable errors keep it so a future provision can
 *     reuse the name.
 *   - **Transient** (anything else: 502 / connection reset / timeout)
 *     — preserve the runtime state and respond `connected` with a
 *     conservative `safeExpiresAt` (only forward if still in the
 *     future) so the next reconnect attempt can succeed.
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

    const refreshedState = sandbox.getState ? sandbox.getState() : null;
    const recoverFailed = row.lifecycle_state === "failed";
    const refreshedExpiresAt = getSandboxExpiresAtDate(refreshedState);

    if (refreshedState || recoverFailed || refreshedExpiresAt) {
      await updateSession(row.id, {
        ...(refreshedState ? { sandbox_state: refreshedState as Json } : {}),
        ...(refreshedExpiresAt ? { sandbox_expires_at: refreshedExpiresAt } : {}),
        ...(recoverFailed ? { lifecycle_state: "active", lifecycle_error: null } : {}),
      });
    }

    const body: ReconnectBody = {
      status: "connected",
      hasSnapshot: !!row.snapshot_url,
      expiresAt: sandbox.expiresAt,
      lifecycle: {
        ...buildLifecycle(row),
        ...(recoverFailed ? { state: "active" } : {}),
        ...(refreshedExpiresAt ? { sandboxExpiresAt: Date.parse(refreshedExpiresAt) } : {}),
      },
    };
    return NextResponse.json(body, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[getSandboxReconnectHandler] probe failed for ${row.id}: ${message}`);

    if (!isSandboxUnavailableError(message)) {
      // Transient: preserve runtime state. Only forward an expiresAt
      // that is still in the future — stale values cause the client
      // to compute a zero/negative timeout and flip to expired.
      const rawExpiresAt = getStateExpiresAt(row.sandbox_state);
      const safeExpiresAt =
        rawExpiresAt !== undefined && rawExpiresAt > Date.now() ? rawExpiresAt : undefined;
      const body: ReconnectBody = {
        status: "connected",
        hasSnapshot: !!row.snapshot_url,
        ...(safeExpiresAt !== undefined ? { expiresAt: safeExpiresAt } : {}),
        lifecycle: buildLifecycle(row),
      };
      return NextResponse.json(body, { status: 200, headers: getCorsHeaders() });
    }

    const clearedState = clearUnavailableSandboxState(row.sandbox_state, message);

    await updateSession(row.id, {
      sandbox_state: clearedState as Json | null,
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
