import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validatePostSandboxesFilesRequest } from "./validatePostSandboxesFilesRequest";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { resolveSubmodulePath } from "@/lib/github/resolveSubmodulePath";
import { createOrUpdateFileContent } from "@/lib/github/createOrUpdateFileContent";
import type { CreateFileResult } from "@/lib/github/createOrUpdateFileContent";
import { del } from "@vercel/blob";
import { downloadFile } from "./downloadFile";

/**
 * Handler for uploading files to a sandbox's GitHub repository.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Accepts JSON body with:
 * - files: Array of { url, name } objects
 * - path: Target directory path within the repository (optional, defaults to root)
 * - message: Commit message (optional, defaults to "Upload files via API")
 *
 * Downloads each file from its URL, commits to GitHub, then deletes
 * the temporary blob.
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
  const allBlobUrls = files.map(file => file.url);

  for (const file of files) {
    const content = await downloadFile(file.url);
    if ("error" in content) {
      errors.push(`${file.name}: ${content.error}`);
      continue;
    }

    const filePath = path ? `${path}/${file.name}` : file.name;
    const resolved = await resolveSubmodulePath({ githubRepo, path: filePath });

    const result = await createOrUpdateFileContent({
      githubRepo: resolved.githubRepo,
      path: resolved.path,
      content,
      message,
    });

    if ("error" in result) {
      errors.push(`${file.name}: ${result.error}`);
    } else {
      uploaded.push(result);
    }
  }

  // Always clean up all temporary blobs, including failed downloads,
  // so customers can retry uploads without "blob already exists" errors
  await Promise.allSettled(allBlobUrls.map(url => del(url)));

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
