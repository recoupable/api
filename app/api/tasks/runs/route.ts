import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getTaskRunHandler } from "@/lib/tasks/getTaskRunHandler";

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
 * GET /api/tasks/runs
 *
 * Lists recent runs for the authenticated account or retrieves one owned run.
 * Returns { status: "success", runs: [...] } on success.
 * Missing, inaccessible, or unattributed runs return 404 without run details.
 *
 * Query parameters:
 * - runId (optional): Retrieve one run instead of listing recent runs
 * - account_id (optional): Target account, subject to existing access checks
 * - limit (optional): List size, 1–100; defaults to 20
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with task run status.
 */
export async function GET(request: NextRequest) {
  return getTaskRunHandler(request);
}
