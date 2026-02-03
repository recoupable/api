import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { updateSnapshotPatchHandler } from "@/lib/sandbox/updateSnapshotPatchHandler";

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
 * PATCH /api/sandboxes/snapshot
 *
 * Updates the snapshot ID for an account. This snapshot will be used
 * as the base environment when creating new sandboxes.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Request body:
 * - snapshotId: string (required) - The snapshot ID to set for the account
 *
 * Response (200):
 * - success: boolean
 * - snapshotId: string - The snapshot ID that was set
 *
 * Error (400/401):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with the updated snapshot ID or error
 */
export async function PATCH(request: NextRequest): Promise<Response> {
  return updateSnapshotPatchHandler(request);
}
