import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSession, type SessionRow } from "@/lib/supabase/sessions/selectSession";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * Translates the snake_case Supabase row into the camelCase shape that
 * open-agents' frontend expects, preserving its existing field names
 * (e.g. `userId` for what is now `account_id`). This keeps the wire
 * format identical so the open-agents frontend can cut over to api
 * with zero frontend code changes.
 *
 * @param row - The Supabase sessions row.
 * @returns The camelCase session payload for HTTP responses.
 */
function toSessionResponse(row: SessionRow) {
  return {
    id: row.id,
    userId: row.account_id,
    title: row.title,
    status: row.status,
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    branch: row.branch,
    cloneUrl: row.clone_url,
    isNewBranch: row.is_new_branch,
    globalSkillRefs: row.global_skill_refs,
    sandboxState: row.sandbox_state,
    lifecycleState: row.lifecycle_state,
    lifecycleVersion: row.lifecycle_version,
    lastActivityAt: row.last_activity_at,
    sandboxExpiresAt: row.sandbox_expires_at,
    hibernateAfter: row.hibernate_after,
    lifecycleRunId: row.lifecycle_run_id,
    lifecycleError: row.lifecycle_error,
    linesAdded: row.lines_added,
    linesRemoved: row.lines_removed,
    snapshotUrl: row.snapshot_url,
    snapshotCreatedAt: row.snapshot_created_at,
    snapshotSizeBytes: row.snapshot_size_bytes,
    cachedDiff: row.cached_diff,
    cachedDiffUpdatedAt: row.cached_diff_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/sessions/{sessionId}
 *
 * Reads a single agent session by id. Authenticates via Privy Bearer
 * token or x-api-key header. Returns 404 if the session does not exist
 * and 403 if it exists but is not owned by the authenticated account.
 *
 * Response shape mirrors open-agents' /api/sessions/[sessionId] so that
 * its frontend can hit this endpoint without changes.
 *
 * @param request - The request object
 * @param options - Route options containing the async params
 * @param options.params - Route params containing the session id
 * @returns A NextResponse with `{ session }` on 200, or an error.
 */
export async function GET(
  request: NextRequest,
  options: { params: Promise<{ sessionId: string }> },
) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { sessionId } = await options.params;
  const row = await selectSession(sessionId);

  if (!row) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  if (row.account_id !== auth.accountId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: getCorsHeaders() });
  }

  return NextResponse.json(
    { session: toSessionResponse(row) },
    { status: 200, headers: getCorsHeaders() },
  );
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
