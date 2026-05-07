import ms from "ms";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateSandboxBody } from "@/lib/sandbox/validateCreateSandboxBody";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { connectSandbox } from "@/lib/sandbox/factory";
import { getSessionSandboxName } from "@/lib/sandbox/getSessionSandboxName";
import { buildSource } from "@/lib/sandbox/buildSource";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
import type { Json } from "@/types/database.types";

const DEFAULT_TIMEOUT_MS = ms("30m");
const DEFAULT_PORTS = [3000];

/**
 * Handles `POST /api/sandbox`. Provisions a Sandbox bound to the given
 * session (or a one-shot sandbox when no `sessionId` is supplied). When
 * a session is bound, the resolved `sandboxState`, lifecycle, and
 * expiry are written back to the `sessions` row so subsequent reads via
 * `GET /api/sandbox/status` can report the sandbox as active. Stale
 * `snapshot_url` / `snapshot_created_at` are cleared on a fresh
 * provision so the UI does not surface a snapshot that no longer
 * matches the current sandbox.
 */
export async function createSandboxHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateSandboxBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { body, auth } = validated;

  const sessionId = body.sessionId;

  let currentLifecycleVersion = 0;
  if (sessionId) {
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

    currentLifecycleVersion = row.lifecycle_version;
  }

  const sandboxName = sessionId ? getSessionSandboxName(sessionId) : undefined;
  const branch = body.branch ?? "main";
  const startTime = Date.now();

  let sandbox;
  try {
    sandbox = await connectSandbox({
      state: {
        type: "vercel",
        ...(sandboxName ? { sandboxName } : {}),
        source: buildSource({ repoUrl: body.repoUrl, branch: body.branch }),
      },
      options: {
        timeout: DEFAULT_TIMEOUT_MS,
        ports: DEFAULT_PORTS,
        githubToken: getServiceGithubToken(),
        persistent: !!sandboxName,
        resume: !!sandboxName,
        createIfMissing: !!sandboxName,
      },
    });
  } catch (error) {
    console.error("[createSandboxHandler] connectSandbox failed:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to provision sandbox" },
      { status: 502, headers: getCorsHeaders() },
    );
  }

  if (sessionId && sandbox.getState) {
    const nextState = sandbox.getState() as Json;
    const expiresAt =
      typeof sandbox.expiresAt === "number" ? new Date(sandbox.expiresAt).toISOString() : null;
    await updateSession(sessionId, {
      sandbox_state: nextState,
      lifecycle_state: "active",
      lifecycle_version: currentLifecycleVersion + 1,
      sandbox_expires_at: expiresAt,
      last_activity_at: new Date().toISOString(),
      snapshot_url: null,
      snapshot_created_at: null,
    });
  }

  return NextResponse.json(
    {
      createdAt: Date.now(),
      timeout: sandbox.timeout ?? DEFAULT_TIMEOUT_MS,
      currentBranch: branch,
      mode: "vercel",
      timing: { readyMs: Date.now() - startTime },
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
