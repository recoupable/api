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
 * Retrieves task runs from Trigger.dev.
 * Supports two modes:
 * - Retrieve mode: when `runId` is provided, returns a single run in `runs: [run]`
 * - List mode: when `runId` is omitted, returns recent runs for the authorized account in `runs: []`
 *
 * Query parameters:
 * - runId (optional): The unique identifier of the task run
 * - account_id (optional): Scope to this account when allowed: admin, org-authorized member, or
 *   personal key with account_id equal to the authenticated account (self-access).
 * - limit (optional): Number of runs to return in list mode (default 20, max 100)
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with task run status.
 */
export async function GET(request: NextRequest) {
  return getTaskRunHandler(request);
}
