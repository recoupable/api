import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureResearchCredits } from "@/lib/research/ensureResearchCredits";

export type ValidatedGetResearchGenresRequest = {
  accountId: string;
};

/**
 * Validates `GET /api/research/genres` — auth only. No required query params.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchGenresRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchGenresRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  const short = await ensureResearchCredits(authResult.accountId);
  if (short) return short;

  return { accountId: authResult.accountId };
}
