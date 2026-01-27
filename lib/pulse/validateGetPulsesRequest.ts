import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { RECOUP_ORG_ID } from "@/lib/const";
import { z } from "zod";

const getPulsesQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
  active: z
    .enum(["true", "false"], { message: "active must be 'true' or 'false'" })
    .transform(val => val === "true")
    .optional(),
});

export type GetPulsesRequestResult = {
  /** Account IDs to query pulses for. If null, return ALL pulse records (Recoup admin). */
  accountIds: string[] | null;
  /** Optional filter by active status */
  active?: boolean;
};

/**
 * Validates GET /api/pulses request.
 * Handles authentication via x-api-key or Authorization bearer token.
 *
 * For personal keys: Returns a single account ID (the key owner's account)
 * For org keys: Returns all account IDs within the organization (can be filtered by account_id)
 * For Recoup admin key: Returns null to indicate ALL pulse records should be returned
 *
 * Query parameters:
 * - account_id: For org API keys, filter to a specific account within the organization
 * - active: Filter by active status (true/false). If undefined, returns all.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated result
 */
export async function validateGetPulsesRequest(
  request: NextRequest,
): Promise<NextResponse | GetPulsesRequestResult> {
  const apiKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  const hasApiKey = !!apiKey;
  const hasAuth = !!authHeader;

  // Enforce exactly one auth mechanism
  if ((hasApiKey && hasAuth) || (!hasApiKey && !hasAuth)) {
    return NextResponse.json(
      { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  // Parse query parameters
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

  let accountId: string;
  let orgId: string | null = null;

  if (hasApiKey) {
    // Validate API key authentication
    const accountIdOrError = await getApiKeyAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;

    // Get org context from API key details
    const keyDetails = await getApiKeyDetails(apiKey!);
    if (keyDetails) {
      orgId = keyDetails.orgId;
    }
  } else {
    // Validate bearer token authentication
    const accountIdOrError = await getAuthenticatedAccountId(request);
    if (accountIdOrError instanceof NextResponse) {
      return accountIdOrError;
    }
    accountId = accountIdOrError;
  }

  // Check if this is the Recoup admin org key
  if (orgId === RECOUP_ORG_ID) {
    // Recoup admin key can see ALL pulse records
    // If account_id is provided, filter to that specific account
    if (targetAccountId) {
      return { accountIds: [targetAccountId], active };
    }
    // Return null to indicate ALL records should be returned
    return { accountIds: null, active };
  }

  // Determine which account IDs to return based on key type
  let accountIds: string[];

  if (orgId) {
    // Org key: Get all members of the organization
    const members = await getAccountOrganizations({ organizationId: orgId });
    accountIds = members.map(m => m.account_id);

    // Also include the org account itself
    if (!accountIds.includes(orgId)) {
      accountIds.push(orgId);
    }

    // If account_id filter is provided, validate it's in the org and filter to just that account
    if (targetAccountId) {
      if (!accountIds.includes(targetAccountId)) {
        return NextResponse.json(
          { status: "error", error: "account_id is not a member of this organization" },
          { status: 403, headers: getCorsHeaders() },
        );
      }
      accountIds = [targetAccountId];
    }
  } else {
    // Personal key: Only return the key owner's account
    if (targetAccountId && targetAccountId !== accountId) {
      return NextResponse.json(
        {
          status: "error",
          error: "Personal API keys cannot filter by account_id",
        },
        { status: 403, headers: getCorsHeaders() },
      );
    }
    accountIds = [accountId];
  }

  return { accountIds, active };
}
