import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteTaskRequest } from "@/lib/tasks/validateDeleteTaskRequest";
import { TASK_ACCESS_DENIED_MESSAGE, deleteTask } from "@/lib/tasks/deleteTask";

/**
 * Deletes an existing task (scheduled action) by its ID
 * Also deletes the corresponding Trigger.dev schedule if it exists
 * Returns only the status of the delete operation
 *
 * Body parameters:
 * - id (required): The task ID to delete
 *
 * @param request - The request object containing the task ID in the body.
 * @returns A NextResponse with the delete operation status.
 */
export async function deleteTaskHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validatedBody = await validateDeleteTaskRequest(request);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    await deleteTask(validatedBody);

    return NextResponse.json(
      {
        status: "success",
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error deleting task:", error);

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
