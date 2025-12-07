import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { validateGetTasksQuery } from "@/lib/tasks/validateGetTasksQuery";

/**
 * Retrieves tasks (scheduled actions) from the database.
 * Supports filtering by id, account_id, or artist_account_id.
 * Returns an array of tasks matching the provided filters.
 * When filtering by `id`, the array will contain at most one task.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with tasks data.
 */
export async function getTasksHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validatedQuery = validateGetTasksQuery(request);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const tasks = await selectScheduledActions(validatedQuery);

    return NextResponse.json(
      {
        status: "success",
        tasks,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error fetching tasks:", error);
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
