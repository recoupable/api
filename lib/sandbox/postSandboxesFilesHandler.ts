import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePostSandboxesFilesRequest } from "./validatePostSandboxesFilesRequest";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { resolveSubmodulePath } from "@/lib/github/resolveSubmodulePath";
import { createOrUpdateFileContent } from "@/lib/github/createOrUpdateFileContent";
import type { CreateFileResult } from "@/lib/github/createOrUpdateFileContent";

/**
 * Handler for uploading files to a sandbox's GitHub repository.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Accepts multipart form data with:
 * - files: One or more files to upload
 * - path: Target directory path within the repository (optional, defaults to root)
 * - message: Commit message (optional, defaults to "Upload files via API")
 *
 * Resolves submodule paths so files in submodule directories are committed
 * to the correct submodule repository.
 *
 * @param request - The request object
 * @returns A NextResponse with uploaded file details or error
 */
export async function postSandboxesFilesHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validatePostSandboxesFilesRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { accountIds, path, message, files } = validated;

  const snapshotAccountId = accountIds?.[0];

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

  const uploaded: CreateFileResult[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path ? `${path}/${file.name}` : file.name;

    const resolved = await resolveSubmodulePath({ githubRepo, path: filePath });

    const result = await createOrUpdateFileContent({
      githubRepo: resolved.githubRepo,
      path: resolved.path,
      content: file.content,
      message,
    });

    if ("error" in result) {
      errors.push(`${file.name}: ${result.error}`);
    } else {
      uploaded.push(result);
    }
  }

  if (uploaded.length === 0) {
    return NextResponse.json(
      { status: "error", error: `All uploads failed: ${errors.join("; ")}` },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    {
      status: "success",
      uploaded,
      ...(errors.length > 0 && { errors }),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}
