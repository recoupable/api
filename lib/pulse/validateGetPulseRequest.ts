import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export type GetPulseRequestResult = {
  accountId: string;
};

/**
 * Validates GET /api/pulse request.
 * Handles authentication via x-api-key or Authorization bearer token,
 * and optional account_id query parameter.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated result
 */
export async function validateGetPulseRequest(
  request: NextRequest,
): Promise<NextResponse | GetPulseRequestResult> {
  const { searchParams } = new URL(request.url);
  const targetAccountId = searchParams.get("account_id");

  const authResult = await validateAuthContext(request, {
    accountId: targetAccountId ?? undefined,
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return { accountId: authResult.accountId };
}
