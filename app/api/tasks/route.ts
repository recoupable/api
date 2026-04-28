import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getTasksHandler } from "@/lib/tasks/getTasksHandler";
import { createTaskHandler } from "@/lib/tasks/createTaskHandler";
import { updateTaskHandler } from "@/lib/tasks/updateTaskHandler";
import { deleteTaskHandler } from "@/lib/tasks/deleteTaskHandler";

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
 * Returns an array of tasks matching the provided filters.
 * When filtering by `id`, the array will contain at most one task.
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

/**
 * POST /api/tasks
 *
 * Creates a new task (scheduled action).
 * Returns the created task in an array, matching GET response shape.
 *
 * Body parameters:
 * - title (required): The title of the task
 * - prompt (required): The prompt for the task
 * - schedule (required): The cron schedule string
 * - account_id (required): The account ID
 * - artist_account_id (required): The artist account ID
 * - model (optional): The model to use for the task
 *
 * @param request - The request object containing the task data in the body.
 * @returns A NextResponse with the created task.
 */
export async function POST(request: NextRequest) {
  return createTaskHandler(request);
}

/**
 * PATCH /api/tasks
 *
 * Updates an existing scheduled task (OpenAPI `UpdateTaskRequest`). Requires auth (`x-api-key` or Bearer);
 * optional body `account_id` follows POST rules (`validateAuthContext`). Validates `id` as UUID; optional
 * fields merge onto the row; unknown keys are rejected. The task row must belong to the resolved account
 * or returns 403. Missing task id → 404. Success body is a `TasksResponse` with one enriched task
 * (`recent_runs`, `upcoming`, `owner_email`), matching GET shape.
 *
 * If `schedule` changes, Trigger.dev sync runs as before.
 *
 * @param request - Request with JSON body.
 * @returns NextResponse (`TasksResponse` on 200).
 */
export async function PATCH(request: NextRequest) {
  return updateTaskHandler(request);
}

/**
 * DELETE /api/tasks
 *
 * Deletes an existing task (scheduled action) by its ID.
 * Also deletes the corresponding Trigger.dev schedule if it exists.
 * Returns only the status of the delete operation.
 *
 * Body parameters:
 * - id (required): The task ID to delete
 *
 * @param request - The request object containing the task ID in the body.
 * @returns A NextResponse with the delete operation status.
 */
export async function DELETE(request: NextRequest) {
  return deleteTaskHandler(request);
}
