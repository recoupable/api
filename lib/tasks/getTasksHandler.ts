import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { validateGetTasksQuery } from "@/lib/tasks/validateGetTasksQuery";
import { enrichTasks } from "@/lib/tasks/enrichTasks";
import { getTaskRunBlock } from "@/lib/plans/getTaskRunBlock";

/**
 * Retrieves tasks (scheduled actions) from the database, enriched with
 * recent_runs and upcoming schedule info from the Trigger.dev API. A single
 * task fetched by `id` (the runner's pre-run read) answers 402 `plan_limit`
 * when the owner's plan no longer allows it, which is what skips the run.
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
    if (validatedQuery.id && tasks.length === 1) {
      const block = await getTaskRunBlock(tasks[0]);
      if (block) {
        return NextResponse.json(block, { status: 402, headers: getCorsHeaders() });
      }
    }
    const enrichedTasks = await enrichTasks(tasks);

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
