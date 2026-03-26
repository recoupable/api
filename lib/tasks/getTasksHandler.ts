import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { validateGetTasksQuery } from "@/lib/tasks/validateGetTasksQuery";
import { enrichTaskWithTriggerInfo } from "@/lib/tasks/enrichTaskWithTriggerInfo";

/**
 * Retrieves tasks (scheduled actions) from the database, enriched with
 * recent_runs and upcoming schedule info from the Trigger.dev API.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with tasks data.
 */
export async function getTasksHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validatedQuery = await validateGetTasksQuery(request);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const tasks = await selectScheduledActions(validatedQuery);

    const enrichedTasks = await Promise.all(tasks.map(task => enrichTaskWithTriggerInfo(task)));

    return NextResponse.json(
      {
        status: "success",
        tasks: enrichedTasks,
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
