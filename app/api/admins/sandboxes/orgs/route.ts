import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAdminSandboxOrgsHandler } from "@/lib/admins/sandboxes/getAdminSandboxOrgsHandler";

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
 * GET /api/admins/sandboxes/orgs
 *
 * Returns commit statistics for each repository in the recoupable GitHub org.
 * Each row includes:
 * - repo_name: string
 * - repo_url: string — GitHub HTML URL
 * - total_commits: number — total commits in the repo
 * - latest_commit_messages: string[] — messages of the latest 5 commits
 * - earliest_committed_at: string — ISO timestamp of the first commit
 * - latest_committed_at: string — ISO timestamp of the most recent commit
 * - account_repos: string[] — list of account repo URLs that include this org repo as a submodule
 *
 * Authentication: x-api-key or Authorization Bearer token required.
 * The authenticated account must be a Recoup admin.
 *
 * Response (200):
 * - status: "success"
 * - repos: Array<OrgRepoRow>
 *
 * Error (401): Unauthorized
 * Error (403): Forbidden (not an admin)
 * Error (500): Internal server error
 *
 * @param request - The request object
 * @returns A NextResponse with org repo stats
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAdminSandboxOrgsHandler(request);
}
