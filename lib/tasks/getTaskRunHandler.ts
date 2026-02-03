import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetTaskRunQuery } from "./validateGetTaskRunQuery";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";

/**
 * Handles GET /api/tasks/runs requests.
 * Retrieves the status of a Trigger.dev task run.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the task run status
 */
export async function getTaskRunHandler(request: NextRequest): Promise<NextResponse> {
  // Validate auth context and query parameters
  const validatedQuery = await validateGetTaskRunQuery(request);
  if (validatedQuery instanceof NextResponse) {
    return validatedQuery;
  }

  try {
    const result = await retrieveTaskRun(validatedQuery.runId);

    if (result === null) {
      return NextResponse.json(
        {
          status: "error",
          error: "Task run not found",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("Error retrieving task run:", error);
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
