import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export type ValidatedGetResearchFestivalsRequest = {
  accountId: string;
};

/**
 * Validates `GET /api/research/festivals` — auth only. No required query params.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchFestivalsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchFestivalsRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  return { accountId: authResult.accountId };
}
