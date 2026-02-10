import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import type { GetAccountOrganizationsParams } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { buildGetOrganizationsParams } from "./buildGetOrganizationsParams";
import { z } from "zod";

const getOrganizationsQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

/**
 * Validates GET /api/organizations request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * For personal keys: Returns accountId with the key owner's account
 * For org keys: Returns organizationId for filtering by org membership
 * For Recoup admin key: Returns empty params to indicate ALL organization records
 *
 * Query parameters:
 * - account_id: Filter to a specific account (validated against org membership)
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or GetAccountOrganizationsParams
 */
export async function validateGetOrganizationsRequest(
  request: NextRequest,
): Promise<NextResponse | GetAccountOrganizationsParams> {
  // Parse query parameters first
  const { searchParams } = new URL(request.url);
  const queryParams = {
    account_id: searchParams.get("account_id") ?? undefined,
  };

  const queryResult = getOrganizationsQuerySchema.safeParse(queryParams);
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

  const { account_id: targetAccountId } = queryResult.data;

  // Use validateAuthContext for authentication
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId, orgId } = authResult;

  // Use shared function to build params
  const { params, error } = await buildGetOrganizationsParams({
    accountId,
    orgId,
    targetAccountId,
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
