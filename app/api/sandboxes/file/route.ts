import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSandboxesFileHandler } from "@/lib/sandbox/getSandboxesFileHandler";

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
 * GET /api/sandboxes/file
 *
 * Retrieves the raw contents of a file from the authenticated account's
 * sandbox GitHub repository. Resolves the github_repo from the account's
 * snapshot, then fetches the file at the specified path.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Query parameters:
 * - path: string (required) - The file path within the repository
 *
 * Response (200):
 * - status: "success"
 * - content: string - The raw file content
 *
 * Error (400/401/403/404):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the file content or error
 */
export async function GET(request: NextRequest): Promise<Response> {
  return getSandboxesFileHandler(request);
}
