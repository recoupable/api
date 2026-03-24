import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccountSnapshots } from "@/lib/supabase/account_snapshots/selectAccountSnapshots";
import { resolveSubmodulePath } from "@/lib/github/resolveSubmodulePath";
import { commitFileToRepo } from "@/lib/github/commitFileToRepo";
import type { CommitFileResult } from "@/lib/github/commitFileToRepo";

/**
 * Handler for uploading files to the authenticated account's GitHub org submodule.
 * Accepts multipart form data with one or more files and a target folder path.
 * Resolves git submodules so files land in the correct repo.
 *
 * @param request - The request object
 * @returns A NextResponse with per-file upload results or an error
 */
export async function uploadSandboxFilesHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid multipart form data" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const folder = formData.get("folder");
  if (!folder || typeof folder !== "string" || folder.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "folder is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const fileEntries = formData.getAll("files");
  const files = fileEntries.filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      { status: "error", error: "At least one file is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const snapshots = await selectAccountSnapshots(accountId);
  const githubRepo = snapshots[0]?.github_repo ?? null;

  if (!githubRepo) {
    return NextResponse.json(
      { status: "error", error: "No GitHub repository found for this account" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  const results: CommitFileResult[] = await Promise.all(
    files.map(async file => {
      const fullPath = `${folder.replace(/\/$/, "")}/${file.name}`;
      const resolved = await resolveSubmodulePath({ githubRepo, path: fullPath });

      const buffer = Buffer.from(await file.arrayBuffer());
      return commitFileToRepo({
        githubRepo: resolved.githubRepo,
        path: resolved.path,
        content: buffer,
        message: `Upload ${file.name}`,
      });
    }),
  );

  return NextResponse.json(
    { status: "success", uploaded: results },
    { status: 200, headers: getCorsHeaders() },
  );
}
