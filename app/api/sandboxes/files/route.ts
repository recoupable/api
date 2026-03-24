import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { uploadSandboxFilesHandler } from "@/lib/sandbox/uploadSandboxFilesHandler";

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
 * Uploads one or more files to the authenticated account's GitHub org submodule.
 * Resolves the target path through git submodules so files land in the correct repo.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body (multipart/form-data):
 * - files: File[] (required) - One or more files to upload
 * - folder: string (required) - Target folder path within the repo
 *   (e.g. ".openclaw/workspace/orgs/myorg")
 *
 * Response (200):
 * - status: "success"
 * - uploaded: [{ path, success, error? }]
 *
 * Error (400/401/404):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with upload results or error
 */
export async function POST(request: NextRequest): Promise<Response> {
  return uploadSandboxFilesHandler(request);
}
