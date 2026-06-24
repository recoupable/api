import ms from "ms";
import { NextRequest, NextResponse, after } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateSandboxBody } from "@/lib/sandbox/validateCreateSandboxBody";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { markSessionSandboxActive } from "@/lib/sandbox/markSessionSandboxActive";
import { connectSandbox } from "@/lib/sandbox/factory";
import { findOrgSnapshot } from "@/lib/sandbox/findOrgSnapshot";
import { getSessionSandboxName } from "@/lib/sandbox/getSessionSandboxName";
import { installSessionGlobalSkills } from "@/lib/sandbox/installSessionGlobalSkills";
import { kickBuildOrgSnapshotWorkflow } from "@/lib/sandbox/kickBuildOrgSnapshotWorkflow";
import { kickSandboxLifecycleWorkflow } from "@/lib/sandbox/kickSandboxLifecycleWorkflow";
import { resolveGitUser } from "@/lib/sandbox/resolveGitUser";
import { extractOrgRepoName } from "@/lib/recoupable/extractOrgRepoName";
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
    const rows = (await selectSessions({ id: sessionId })) ?? [];
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

  // Miss: kick a background workflow to build a snapshot for this org so
  // the *next* session warm-boots from it. This request still pays the
  // full-clone cold-start path — the workflow runs durably outside the
  // request lifecycle.
  if (orgRepoName && !orgSnapshotId) {
    kickBuildOrgSnapshotWorkflow({
      cloneUrl: body.repoUrl,
      sandboxName: orgRepoName,
    });
  }

  const startTime = Date.now();

  // Per-account `gitUser` controls commit authorship inside the sandbox
  // (`git config user.name` / `user.email`). The push credential is a
  // separate hardcoded service token — `gitUser` is purely about who
  // each commit object is *authored* by.
  const gitUser = await resolveGitUser(auth.accountId);

  let sandbox;
  try {
    sandbox = await connectSandbox({
      state: {
        type: "vercel",
        ...(sandboxName ? { sandboxName } : {}),
        // `prebuilt: true` when restoring from an org snapshot tells the
        // Vercel sandbox runtime to skip the fresh `git clone` and instead
        // `git fetch` + `git reset --hard` the repo that's already inside
        // the snapshot. Without this flag, Vercel treats the snapshot as a
        // base image and tries to clone fresh on top — which often fails
        // for private repos and definitely defeats the warm-boot benefit.
        source: { repo: body.repoUrl, prebuilt: !!orgSnapshotId },
      },
      options: {
        timeout: DEFAULT_TIMEOUT_MS,
        ports: DEFAULT_PORTS,
        githubToken: getServiceGithubToken(),
        gitUser,
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
    // Bind the sandbox to the session + mark it active via the shared helper
    // (also used by the headless `provisionGenerateSession`). It derives the
    // lifecycle fields from the state object's `expiresAt` — always populated by
    // the SDK, even on prebuilt-snapshot paths — rather than `sandbox.expiresAt`,
    // which is only set on some creation paths.
    await markSessionSandboxActive(sessionRow, sandbox.getState() as Json);
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

    // Register the new sandbox with the lifecycle workflow so it gets
    // auto-paused after SANDBOX_INACTIVITY_TIMEOUT_MS of idle. The
    // kick chain (selectSessions → claim lease → start workflow) is
    // registered with `after()` so the serverless platform keeps the
    // function alive past the response until the chain completes —
    // without that, the chain dies on function teardown and the
    // workflow never starts. Failures are logged and never surfaced.
    kickSandboxLifecycleWorkflow({
      sessionId: sessionRow.id,
      reason: "sandbox-created",
      scheduleBackgroundWork: task => after(() => task),
    });
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
