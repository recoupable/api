import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { SelectPulseAccountsParams } from "@/lib/supabase/pulse_accounts/selectPulseAccounts";
import { buildGetPulsesParams } from "./buildGetPulsesParams";
import { z } from "zod";

const getPulsesQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  active: z
    .enum(["true", "false"], { message: "active must be 'true' or 'false'" })
    .transform(val => val === "true")
    .optional(),
});

/**
 * Validates GET /api/pulses request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * For personal keys: Returns accountIds with the key owner's account
 * For org keys: Returns orgId for filtering by org membership in database
 * For Recoup admin key: Returns empty params to indicate ALL pulse records
 *
 * Query parameters:
 * - account_id: Filter to a specific account (validated against org membership)
 * - active: Filter by active status (true/false). If undefined, returns all.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or SelectPulseAccountsParams
 */
export async function validateGetPulsesRequest(
  request: NextRequest,
): Promise<NextResponse | SelectPulseAccountsParams> {
  // Parse query parameters first
  const { searchParams } = new URL(request.url);
  const queryParams = {
    account_id: searchParams.get("account_id") ?? undefined,
    active: searchParams.get("active") ?? undefined,
  };

  const queryResult = getPulsesQuerySchema.safeParse(queryParams);
  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const { account_id: targetAccountId, active } = queryResult.data;

  // Use validateAuthContext for authentication
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId, orgId } = authResult;

  // Use shared function to build params
  const { params, error } = await buildGetPulsesParams({
    accountId,
    orgId,
    targetAccountId,
    active,
  });

  if (error) {
    return NextResponse.json(
      {
        status: "error",
        error,
      },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  return params;
}
