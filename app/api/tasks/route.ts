import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getTasksHandler } from "@/lib/tasks/getTasksHandler";

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
 * GET /api/tasks
 *
 * Retrieves tasks (scheduled actions) from the database.
 * Supports filtering by id, account_id, or artist_account_id.
 * If an `id` is provided, returns a single task matching that ID.
 * Otherwise, returns an array of all tasks (optionally filtered).
 *
 * Query parameters:
 * - id (optional): Filter by task ID
 * - account_id (optional): Filter by account ID
 * - artist_account_id (optional): Filter by artist account ID
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with tasks data.
 */
export async function GET(request: NextRequest) {
  return getTasksHandler(request);
}

