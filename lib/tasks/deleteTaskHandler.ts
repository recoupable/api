import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateDeleteTaskBody } from "@/lib/tasks/validateDeleteTaskBody";
import { deleteTask } from "@/lib/tasks/deleteTask";

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
    const body = await request.json();

    const validatedBody = validateDeleteTaskBody(body);
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
