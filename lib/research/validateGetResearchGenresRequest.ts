import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

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

  return { accountId: authResult.accountId };
}
