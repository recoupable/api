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
 * Retrieves the status of a Trigger.dev task run.
 * Returns one of three possible statuses:
 * - pending: Task is still running
 * - complete: Task completed successfully with data
 * - failed: Task failed with error message
 *
 * Query parameters:
 * - runId (required): The unique identifier of the task run
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with task run status.
 */
export async function GET(request: NextRequest) {
  return getTaskRunHandler(request);
}
