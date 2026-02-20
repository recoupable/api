import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetSandboxesFileRequest } from "./validateGetSandboxesFileRequest";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { getRawFileContent } from "@/lib/github/getRawFileContent";

/**
 * Handler for retrieving file contents from a sandbox's GitHub repository.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Resolves the github_repo from the authenticated account's snapshot,
 * then fetches the raw file content from the repository.
 *
 * Query parameters:
 * - path: The file path within the repository (required)
 *
 * @param request - The request object.
 * @returns A NextResponse with the file content or error.
 */
export async function getSandboxesFileHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetSandboxesFileRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { accountIds, orgId, path } = validated;

  // Determine account ID for snapshot lookup (same pattern as getSandboxesHandler)
  const snapshotAccountId = accountIds?.length === 1 ? accountIds[0] : orgId;

  if (!snapshotAccountId) {
    return NextResponse.json(
      { status: "error", error: "Could not determine account for snapshot lookup" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const snapshots = await selectAccountSnapshots(snapshotAccountId);
  const githubRepo = snapshots[0]?.github_repo ?? null;

  if (!githubRepo) {
    return NextResponse.json(
      { status: "error", error: "No GitHub repository found for this account" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const result = await getRawFileContent({ githubRepo, path });

  if ("error" in result) {
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { status: "success", content: result.content },
    { status: 200, headers: getCorsHeaders() },
  );
}
