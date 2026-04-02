import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateUpdateTaskBody } from "@/lib/tasks/validateUpdateTaskBody";
import { updateTask } from "@/lib/tasks/updateTask";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";

/**
 * Updates an existing task (scheduled action)
 * Only the `id` field is required; any additional fields will be updated.
 * If `schedule` (cron) is updated, the corresponding Trigger.dev schedule is also updated.
 * Returns the updated task in an array, matching GET response shape
 *
 * Body parameters:
 * - id (required): The task ID to update
 * - title (optional): The title of the task
 * - prompt (optional): The prompt for the task
 * - schedule (optional): The cron schedule string
 * - account_id (optional): The account ID
 * - artist_account_id (optional): The artist account ID
 * - enabled (optional): Whether the task is enabled
 * - model (optional): The model to use for the task
 *
 * @param request - The request object containing the task data in the body.
 * @returns A NextResponse with the updated task.
 */
export async function updateTaskHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();

    const validatedBody = validateUpdateTaskBody(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const existingTasks = await selectScheduledActions({ id: validatedBody.id });
    const existingTask = existingTasks[0];

    if (!existingTask) {
      return NextResponse.json(
        { status: "error", error: "Task not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    const accessResult = await validateAccountIdOverride({
      currentAccountId: authResult.accountId,
      targetAccountId: existingTask.account_id,
    });

    if (accessResult instanceof NextResponse) {
      return accessResult;
    }

    const { account_id: _ignoredAccountId, ...safeBody } = validatedBody;
    const updatedTask = await updateTask(safeBody);

    return NextResponse.json(
      {
        status: "success",
        tasks: [updatedTask],
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error updating task:", error);

    // Handle "Task not found" error with 404 status
    if (error instanceof Error && error.message === "Task not found") {
      return NextResponse.json(
        {
          status: "error",
          error: error.message,
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
