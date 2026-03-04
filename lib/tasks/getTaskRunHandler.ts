import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetTaskRunQuery } from "./validateGetTaskRunQuery";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { listTaskRuns } from "@/lib/trigger/listTaskRuns";
import { persistCreateContentRunVideo } from "@/lib/content/persistCreateContentRunVideo";

/**
 * Handles GET /api/tasks/runs requests.
 * Always returns { status: "success", runs: [...] }.
 * When runId is provided, runs contains a single element.
 * When omitted, runs contains recent runs for the authenticated account.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with the runs array
 */
export async function getTaskRunHandler(request: NextRequest): Promise<NextResponse> {
  const validatedQuery = await validateGetTaskRunQuery(request);
  if (validatedQuery instanceof NextResponse) {
    return validatedQuery;
  }

  try {
    if (validatedQuery.mode === "list") {
      const runs = await listTaskRuns(validatedQuery.accountId, validatedQuery.limit);
      const hydratedRuns = await Promise.all(runs.map(run => persistCreateContentRunVideo(run)));
      return NextResponse.json(
        { status: "success", runs: hydratedRuns },
        { status: 200, headers: getCorsHeaders() },
      );
    }

    const result = await retrieveTaskRun(validatedQuery.runId);

    if (result === null) {
      return NextResponse.json(
        { status: "error", error: "Task run not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    const hydratedRun = await persistCreateContentRunVideo(result);

    return NextResponse.json(
      { status: "success", runs: [hydratedRun] },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error retrieving task run:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
