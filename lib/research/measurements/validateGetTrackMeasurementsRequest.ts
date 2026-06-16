import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

const DEFAULT_PLATFORM = "spotify";
const DEFAULT_METRIC = "platform_displayed_play_count";
const DEFAULT_WINDOW_DAYS = 365;

export type ValidatedGetTrackMeasurementsRequest = {
  accountId: string;
  id: string;
  platform: string;
  metric: string;
  aggregate?: "run_rate";
  windowDays: number;
};

/**
 * Validates `GET /api/research/tracks/{id}/measurements` — auth, research
 * credits, and the projection query params (`platform`, `metric`, `aggregate`,
 * `window`). `aggregate` may only be `run_rate`; `window` like `365d` → days.
 *
 * @param request - The incoming HTTP request.
 * @param id - The provider-neutral track id from the path.
 */
export async function validateGetTrackMeasurementsRequest(
  request: NextRequest,
  id: string,
): Promise<NextResponse | ValidatedGetTrackMeasurementsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);

  const aggregateParam = searchParams.get("aggregate");
  if (aggregateParam !== null && aggregateParam !== "run_rate") {
    return errorResponse("aggregate must be run_rate", 400);
  }

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  const windowMatch = (searchParams.get("window") ?? "").match(/^(\d+)d?$/);
  const windowDays = windowMatch ? Number(windowMatch[1]) : DEFAULT_WINDOW_DAYS;

  return {
    accountId: authResult.accountId,
    id,
    platform: searchParams.get("platform") ?? DEFAULT_PLATFORM,
    metric: searchParams.get("metric") ?? DEFAULT_METRIC,
    aggregate: aggregateParam === "run_rate" ? "run_rate" : undefined,
    windowDays,
  };
}
