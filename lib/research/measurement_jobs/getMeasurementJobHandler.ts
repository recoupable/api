import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getMeasurementJob } from "@/lib/research/measurement_jobs/getMeasurementJob";

/**
 * GET /api/research/measurement-jobs/{id}
 *
 * Poll a `current` measurement job's status. Authenticated but uncharged —
 * polling a job you created should not cost research credits.
 *
 * @param request - The incoming HTTP request.
 * @param id - The measurement-job id from the path.
 * @returns The JSON response.
 */
export async function getMeasurementJobHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const result = await getMeasurementJob({ id });
    if ("error" in result) return errorResponse(result.error, result.status);

    return successResponse(result.data as Record<string, unknown>);
  } catch (error) {
    console.error("[ERROR] getMeasurementJobHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
