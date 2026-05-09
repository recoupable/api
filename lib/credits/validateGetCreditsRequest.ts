import { type NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export type ValidatedGetCreditsRequest = {
  accountId: string;
};

/**
 * Validates `GET /api/credits` — wraps `validateAuthContext` and
 * exposes the resolved `accountId` to the handler. Returns the auth
 * error response unchanged on failure.
 *
 * @param request - The incoming HTTP request.
 */
export async function validateGetCreditsRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetCreditsRequest> {
  const authContext = await validateAuthContext(request, {});
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return { accountId: authContext.accountId };
}
