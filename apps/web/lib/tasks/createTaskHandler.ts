import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskRequest";
import { createTask } from "@/lib/tasks/createTask";

/**
 * Creates a new task (scheduled action)
 * Returns the created task in an array, matching GET response shape
 *
 * Body parameters (JSON):
 * - title (required): The title of the task
 * - prompt (required): The prompt for the task
 * - schedule (required): The cron schedule string
 * - artist_account_id (required): The artist account ID
 * - model (optional): The model to use for the task
 *
 * Optional body `account_id` selects the account when org/API-key rules allow; otherwise the authenticated account is used. See OpenAPI `CreateTaskRequest`.
 *
 * @param request - The request object containing the task data in the body.
 * @returns A NextResponse with the created task.
 */
export async function createTaskHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validatedBody = await validateCreateTaskRequest(request);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    const createdTask = await createTask(validatedBody);

    return NextResponse.json(
      {
        status: "success",
        tasks: [createdTask],
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error creating task:", error);
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
