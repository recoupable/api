import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { enrichTasks } from "@/lib/tasks/enrichTasks";
import { validateUpdateTaskRequest } from "@/lib/tasks/validateUpdateTaskRequest";
import { TASK_ACCESS_DENIED_MESSAGE, updateTask } from "@/lib/tasks/updateTask";

/**
 * Updates an existing task (scheduled action).
 * Only the `id` field is required; any additional fields will be updated.
 * If `schedule` (cron) is updated, the corresponding Trigger.dev schedule is also updated.
 * Returns the updated task in an array, matching GET response shape.
 *
 * Auth: `validateAuthContext` (401/403) with optional body `account_id` per OpenAPI `UpdateTaskRequest`.
 * The task row must belong to the resolved account or 403 is returned.
 *
 * @param request - The request object containing the task data in the body.
 * @returns A NextResponse with the updated task.
 */
export async function updateTaskHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validatedBody = await validateUpdateTaskRequest(request);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const updatedTask = await updateTask(validatedBody);
    const [enrichedTask] = await enrichTasks([updatedTask]);

    return NextResponse.json(
      {
        status: "success",
        tasks: [enrichedTask],
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error updating task:", error);

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

    if (error instanceof Error && error.message === TASK_ACCESS_DENIED_MESSAGE) {
      return NextResponse.json(
        {
          status: "error",
          error: error.message,
        },
        {
          status: 403,
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
