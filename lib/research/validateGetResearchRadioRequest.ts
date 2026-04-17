import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export type ValidatedGetResearchRadioRequest = {
  accountId: string;
};

/**
 * Validates `GET /api/research/radio` — auth only. No required query params.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetResearchRadioRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetResearchRadioRequest> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  return { accountId: authResult.accountId };
}
