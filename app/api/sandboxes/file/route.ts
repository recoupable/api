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
 * Retrieves the raw contents of a file from the authenticated or explicitly authorized account's
 * sandbox GitHub repository. Resolves the github_repo from the account's
 * snapshot, then fetches the file at the specified path.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Query parameters:
 * - path: string (required) - The file path within the repository
 * - include_revision: "true" (optional) - Read content and blob SHA together from main
 * - account_id: UUID (optional) - Target account, checked by the sandbox-list access policy
 *
 * Paths must be canonical relative paths: dot/traversal, backslashes, malformed Unicode
 * and leading/trailing/doubled slashes return 400, including for legacy callers.
 *
 * Response (200):
 * - status: "success"
 * - content: string - The raw file content
 * - encoding: "base64" - Present for recognized binary extensions; content is base64
 * - sha: string - Present for include_revision=true; use as files[].expected_sha
 * - account_id: string - Present only when an explicit account_id was authorized
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
