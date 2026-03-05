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
      // Best-effort hydration: if video persistence fails for a run, return the original run.
      const hydratedRuns = await Promise.all(
        runs.map(async run => {
          try {
            return await persistCreateContentRunVideo(run);
          } catch (err) {
            console.error("Video hydration failed for run", run.id, err);
            return run;
          }
        }),
      );
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

    // Best-effort hydration: if video persistence fails, return the original run.
    let hydratedRun;
    try {
      hydratedRun = await persistCreateContentRunVideo(result);
    } catch (err) {
      console.error("Video hydration failed for run", result.id, err);
      hydratedRun = result;
    }

    return NextResponse.json({ status: "success", runs: [hydratedRun] }, {
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
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
