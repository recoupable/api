import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

const updatePulsesBodySchema = z.object({
  active: z.boolean({ message: "active must be a boolean" }),
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export type UpdatePulsesRequestResult = {
  /** The account ID to update */
  accountId: string;
  /** The new active status */
  active: boolean;
};

/**
 * Validates PATCH /api/pulses request.
 * Handles authentication via x-api-key or Authorization bearer token,
 * body validation, and optional account_id override.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated result
 */
export async function validateUpdatePulsesRequest(
  request: NextRequest,
): Promise<NextResponse | UpdatePulsesRequestResult> {
  const body = await safeParseJson(request);

  const bodyResult = updatePulsesBodySchema.safeParse(body);
  if (!bodyResult.success) {
    const firstError = bodyResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { active, account_id: targetAccountId } = bodyResult.data;

  const authResult = await validateAuthContext(request, {
    accountId: targetAccountId,
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return { accountId: authResult.accountId, active };
}
