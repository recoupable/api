import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteSandboxBody } from "@/lib/sandbox/validateDeleteSandboxBody";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { deleteAccountSnapshot } from "@/lib/supabase/account_snapshots/deleteAccountSnapshot";
import { deleteGithubRepo } from "@/lib/github/deleteGithubRepo";
import { findOrgReposByAccountId } from "@/lib/github/findOrgReposByAccountId";

/**
 * Deletes GitHub repos for an account. First checks the snapshot's github_repo field,
 * then falls back to searching the recoupable org for repos matching the account ID.
 *
 * @param accountId - The account ID
 * @param githubRepoUrl - The github_repo URL from the snapshot, if any
 * @returns true if all deletions succeeded or nothing to delete, false if any deletion failed
 */
async function deleteGithubRepos(
  accountId: string,
  githubRepoUrl: string | null,
): Promise<boolean> {
  const repoUrls: string[] = [];

  if (githubRepoUrl) {
    repoUrls.push(githubRepoUrl);
  }

  const orgRepos = await findOrgReposByAccountId(accountId);
  for (const url of orgRepos) {
    if (!repoUrls.includes(url)) {
      repoUrls.push(url);
    }
  }

  if (repoUrls.length === 0) {
    return true;
  }

  for (const url of repoUrls) {
    const deleted = await deleteGithubRepo(url);
    if (!deleted) {
      return false;
    }
  }

  return true;
}

/**
 * Handler for DELETE /api/sandboxes.
 *
 * Deletes the GitHub repository and snapshot record for an account.
 * If no snapshot exists, searches the recoupable GitHub org for repos
 * matching the account ID and deletes them.
 * Requires authentication via x-api-key header or Authorization Bearer token.
 *
 * @param request - The request object
 * @returns A NextResponse with the deletion result or error
 */
export async function deleteSandboxHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateDeleteSandboxBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const snapshots = await selectAccountSnapshots(validated.accountId);
  const snapshot = snapshots[0];

  try {
    const reposDeleted = await deleteGithubRepos(
      validated.accountId,
      snapshot?.github_repo ?? null,
    );

    if (!reposDeleted) {
      return NextResponse.json(
        { status: "error", error: "Failed to delete GitHub repository" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    if (!snapshot) {
      return NextResponse.json(
        { status: "success", deleted_snapshot: null },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    const deletedSnapshot = await deleteAccountSnapshot(validated.accountId);

    return NextResponse.json(
      { status: "success", deleted_snapshot: deletedSnapshot ?? snapshot },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete sandbox";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
