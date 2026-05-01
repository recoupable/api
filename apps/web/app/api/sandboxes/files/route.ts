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
 * repository. Accepts multipart form data with files and an optional target
 * directory path. Resolves submodule paths so files in submodule directories
 * are committed to the correct repository.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Form data:
 * - files: File[] (required) - One or more files to upload
 * - path: string (optional) - Target directory path within the repository
 * - message: string (optional) - Commit message (defaults to "Upload files via API")
 *
 * Response (200):
 * - status: "success"
 * - uploaded: Array<{ path: string, sha: string }>
 *
 * Error (400/401/403/404/500):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with uploaded file details or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return postSandboxesFilesHandler(request);
}
