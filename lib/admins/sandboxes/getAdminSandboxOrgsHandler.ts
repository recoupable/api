import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
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
 * - account_repos (list of account repo URLs that include this org repo as a submodule)
 *
 * Requires the caller to be a Recoup admin.
 *
 * @param request - The request object
 * @returns A NextResponse with the list of org repo stats or an error
 */
export async function getAdminSandboxOrgsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAdminAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
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
