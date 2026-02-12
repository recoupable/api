import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteSandboxBody } from "@/lib/sandbox/validateDeleteSandboxBody";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { deleteAccountSnapshot } from "@/lib/supabase/account_snapshots/deleteAccountSnapshot";
import { deleteAccountGithubRepos } from "@/lib/github/deleteAccountGithubRepos";

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
    const reposDeleted = await deleteAccountGithubRepos(
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
