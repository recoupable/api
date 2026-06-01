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
 * Returns task runs for the authenticated account.
 * When `runId` is provided, returns `{ status: "success", runs: [run] }` or 404 if missing.
 * When `runId` is omitted, returns recent runs for account scope (default authenticated account,
 * or `account_id` override when authorized).
 *
 * Query parameters:
 * - runId (optional): Retrieve one specific run
 * - account_id (optional): Account scope override (UUID, when authorized)
 * - limit (optional): Max runs for list mode (default 20, max 100)
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with task run data.
 */
export async function GET(request: NextRequest) {
  return getTaskRunHandler(request);
}
