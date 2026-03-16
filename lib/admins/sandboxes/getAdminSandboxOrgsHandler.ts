import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkIsAdmin } from "../checkIsAdmin";
import { getOrgRepoStats } from "./getOrgRepoStats";
import { selectAllAccountSnapshotGithubRepos } from "@/lib/supabase/account_snapshots/selectAllAccountSnapshotGithubRepos";

/**
 * Handler for GET /api/admins/sandboxes/orgs.
 *
 * Returns commit statistics for each repository in the recoupable GitHub org:
 * - repo_name
 * - repo_url
 * - total_commits
 * - latest_commit_messages (latest 5)
 * - earliest_committed_at
 * - latest_committed_at
 * - account_repo_count (number of account repos with this org repo as a submodule)
 *
 * Requires the caller to be a Recoup admin.
 *
 * @param request - The request object
 * @returns A NextResponse with the list of org repo stats or an error
 */
export async function getAdminSandboxOrgsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAuthContext(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const isAdmin = await checkIsAdmin(auth.accountId);
    if (!isAdmin) {
      return NextResponse.json(
        { status: "error", message: "Forbidden" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    const accountGithubRepos = await selectAllAccountSnapshotGithubRepos();
    const repos = await getOrgRepoStats(accountGithubRepos);

    return NextResponse.json(
      { status: "success", repos },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getAdminSandboxOrgsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
