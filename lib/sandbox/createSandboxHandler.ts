import ms from "ms";
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateSandboxBody } from "@/lib/sandbox/validateCreateSandboxBody";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { connectSandbox } from "@/lib/sandbox/factory";
import { findOrgSnapshot } from "@/lib/sandbox/findOrgSnapshot";
import { getSessionSandboxName } from "@/lib/sandbox/getSessionSandboxName";
import { installSessionGlobalSkills } from "@/lib/sandbox/installSessionGlobalSkills";
import { extractOrgRepoName } from "@/lib/recoupable/extractOrgRepoName";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
import type { Json, Tables } from "@/types/database.types";

const DEFAULT_TIMEOUT_MS = ms("30m");
const DEFAULT_PORTS = [3000];
const DEFAULT_BRANCH = "main";

/**
 * Handles `POST /api/sandbox`. Provisions a Sandbox bound to the given
 * session (or a one-shot sandbox when no `sessionId` is supplied) using
 * the repo's default branch — there is no input branch override; the
 * chat UX always works against whatever the repo treats as default.
 *
 * When a session is bound, the resolved `sandbox_state`, lifecycle, and
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

  let sessionRow: Tables<"sessions"> | null = null;
  if (sessionId) {
    const rows = await selectSessions({ id: sessionId });
    sessionRow = rows[0] ?? null;

    if (!sessionRow) {
      return NextResponse.json(
        { status: "error", error: "Session not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    if (sessionRow.account_id !== auth.accountId) {
      return NextResponse.json(
        { status: "error", error: "Forbidden" },
        { status: 403, headers: getCorsHeaders() },
      );
    }
  }

  const sandboxName = sessionId ? getSessionSandboxName(sessionId) : undefined;

  // Per-org base snapshot lookup — saves ~75s on cold start when found.
  // Skipped entirely for non-recoupable repos so this only costs latency
  // for the case where it can pay off. A miss falls through to default
  // sandbox provisioning; an error is logged and treated as a miss.
  const orgRepoName = extractOrgRepoName(body.repoUrl);
  const orgSnapshotId = orgRepoName ? await findOrgSnapshot(orgRepoName) : null;

  const startTime = Date.now();

  let sandbox;
  try {
    sandbox = await connectSandbox({
      state: {
        type: "vercel",
        ...(sandboxName ? { sandboxName } : {}),
        source: { repo: body.repoUrl },
      },
      options: {
        timeout: DEFAULT_TIMEOUT_MS,
        ports: DEFAULT_PORTS,
        githubToken: getServiceGithubToken(),
        ...(orgSnapshotId ? { baseSnapshotId: orgSnapshotId } : {}),
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

  if (sessionRow && sandbox.getState) {
    const nextState = sandbox.getState() as Json;
    const expiresAt =
      typeof sandbox.expiresAt === "number" ? new Date(sandbox.expiresAt).toISOString() : null;
    await updateSession(sessionRow.id, {
      sandbox_state: nextState,
      lifecycle_state: "active",
      lifecycle_version: sessionRow.lifecycle_version + 1,
      sandbox_expires_at: expiresAt,
      last_activity_at: new Date().toISOString(),
      snapshot_url: null,
      snapshot_created_at: null,
    });
  }

  // Best-effort skill installation — a failure here does not fail the
  // sandbox creation request. The agent will start without skills loaded
  // (or with whatever subset successfully installed before the throw),
  // which the user can recover from with a follow-up request once the
  // underlying issue is fixed.
  if (sessionRow) {
    try {
      await installSessionGlobalSkills({ sessionRow, sandbox });
    } catch (error) {
      console.error(
        `[createSandboxHandler] installSessionGlobalSkills failed for session ${sessionRow.id}:`,
        error,
      );
    }
  }

  return NextResponse.json(
    {
      createdAt: Date.now(),
      timeout: sandbox.timeout ?? DEFAULT_TIMEOUT_MS,
      currentBranch: sandbox.currentBranch ?? DEFAULT_BRANCH,
      mode: "vercel",
      timing: { readyMs: Date.now() - startTime },
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
