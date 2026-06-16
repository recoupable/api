import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createMeasurementJob } from "@/lib/research/measurement_jobs/createMeasurementJob";
import { validateCreateMeasurementJobRequest } from "@/lib/research/measurement_jobs/validateCreateMeasurementJobRequest";

/**
 * POST /api/research/measurement-jobs
 *
 * One async ingest resource. `source:"current"` captures present counts via the
 * snapshot pipeline (replaces `POST /api/research/snapshots`); `source:"historical"`
 * enqueues Songstats deep backfill ranked by all-time streams (idempotent —
 * already-backfilled songs are skipped). Returns 202.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function createMeasurementJobHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateCreateMeasurementJobRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await createMeasurementJob(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    return NextResponse.json(result.data, { status: 202, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] createMeasurementJobHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
