import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postSandboxesFilesHandler } from "@/lib/sandbox/postSandboxesFilesHandler";

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
 * POST /api/sandboxes/files
 *
 * Uploads one or more files to the authenticated account's sandbox GitHub
 * repository. Accepts JSON file URLs and an optional target
 * directory path. Resolves submodule paths so files in submodule directories
 * are committed to the correct repository.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * JSON body:
 * - files: Array<{ url, name, expected_sha? }> (required)
 *   expected_sha guards an existing file on main against the reader-observed blob SHA.
 *   Omission retains legacy unconditional create/update behavior.
 * - path: string (optional) - Target directory path within the repository
 * - message: string (optional) - Commit message (defaults to "Upload files via API")
 *
 * Response (200):
 * - status: "success"
 * - uploaded: Array<{ path: string, sha: string }>
 *
 * Partial successes retain 200 with uploaded/errors and optional conflicts.
 * All-failed batches where every failure is a Git conflict return 409 with conflicts (file names).
 * No batch-level transaction or automatic conflict retry is performed.
 *
 * Error (400/401/403/404/409/500):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with uploaded file details or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return postSandboxesFilesHandler(request);
}
