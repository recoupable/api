import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateUpdatePulseBody } from "./validateUpdatePulseBody";

export type UpdatePulseRequestResult = {
  accountId: string;
  active: boolean;
};

/**
 * Validates PATCH /api/pulse request.
 * Handles authentication via x-api-key or Authorization bearer token,
 * body validation, and optional account_id override.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated result
 */
export async function validateUpdatePulseRequest(
  request: NextRequest,
): Promise<NextResponse | UpdatePulseRequestResult> {
  const body = await safeParseJson(request);
  const validated = validateUpdatePulseBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { active, account_id: targetAccountId } = validated;

  const authResult = await validateAuthContext(request, {
    accountId: targetAccountId,
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return { accountId: authResult.accountId, active };
}
