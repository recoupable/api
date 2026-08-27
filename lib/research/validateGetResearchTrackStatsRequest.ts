import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

export type ValidatedGetResearchTrackStatsRequest = {
  accountId: string;
  isrc: string;
};

/**
 * Validates `GET /api/research/track/stats` — auth, a required `isrc`, an
 * optional `source` that must be `spotify` (the only platform the measurement
 * store serves), and research credits.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchTrackStatsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchTrackStatsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);

  const isrc = searchParams.get("isrc");
  if (!isrc) return errorResponse("isrc parameter is required", 400);

  const source = searchParams.get("source") ?? "spotify";
  if (source !== "spotify") return errorResponse("source must be spotify", 400);

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId, isrc };
}
