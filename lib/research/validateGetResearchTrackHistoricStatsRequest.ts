import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchTrackHistoricStatsRequest = {
  accountId: string;
  isrc: string;
  /** Inclusive lower bound (YYYY-MM-DD). */
  startDate?: string;
  /** Inclusive upper bound (YYYY-MM-DD). */
  endDate?: string;
};

/**
 * Validates `GET /api/research/track/historic-stats` — auth, a required
 * `isrc`, an optional `source` that must be `spotify`, an optional
 * `start_date` / `end_date` window, and research credits.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchTrackHistoricStatsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchTrackHistoricStatsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);

  const isrc = searchParams.get("isrc");
  if (!isrc) return errorResponse("isrc parameter is required", 400);

  const source = searchParams.get("source") ?? "spotify";
  if (source !== "spotify") return errorResponse("source must be spotify", 400);

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  return {
    accountId: authResult.accountId,
    isrc,
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}
