import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";
import { errorResponse } from "@/lib/networking/errorResponse";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ValidatedGetPlaycountDeltasRequest = {
  accountId: string;
  isrc: string;
  since: string;
  until?: string;
};

/**
 * Validates `GET /api/research/track/playcount-deltas` — auth, required
 * `isrc` + `since` (YYYY-MM-DD), optional `until`, and research credits.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetPlaycountDeltasRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetPlaycountDeltasRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);

  const isrc = searchParams.get("isrc");
  if (!isrc) return errorResponse("isrc parameter is required", 400);

  const since = searchParams.get("since");
  if (!since || !DATE_PATTERN.test(since)) {
    return errorResponse("since parameter is required (YYYY-MM-DD)", 400);
  }

  const until = searchParams.get("until");
  if (until && !DATE_PATTERN.test(until)) {
    return errorResponse("until must be a date (YYYY-MM-DD)", 400);
  }

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId, isrc, since, ...(until ? { until } : {}) };
}
