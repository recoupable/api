import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { RECOUP_ORG_ID } from "@/lib/const";
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
  /** Account IDs to return in the response (for consistency with GET) */
  responseAccountIds: string[] | null;
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

  // Determine the account to update and accounts to return in response
  let updateAccountId = accountId;
  let responseAccountIds: string[] | null;

  // Check if this is the Recoup admin org key
  if (orgId === RECOUP_ORG_ID) {
    // Recoup admin key can update any account
    if (targetAccountId) {
      updateAccountId = targetAccountId;
    }
    // Return null to indicate ALL records should be returned in response
    responseAccountIds = null;
  } else if (orgId) {
    // Org key: Get all members of the organization
    const members = await getAccountOrganizations({ organizationId: orgId });
    const memberAccountIds = members.map(m => m.account_id);

    // Also include the org account itself
    if (!memberAccountIds.includes(orgId)) {
      memberAccountIds.push(orgId);
    }

    // If account_id is provided, validate it's in the org
    if (targetAccountId) {
      if (!memberAccountIds.includes(targetAccountId)) {
        return NextResponse.json(
          { status: "error", error: "account_id is not a member of this organization" },
          { status: 403, headers: getCorsHeaders() },
        );
      }
      updateAccountId = targetAccountId;
    }

    responseAccountIds = memberAccountIds;
  } else {
    // Personal key: Can only update own account
    if (targetAccountId && targetAccountId !== accountId) {
      return NextResponse.json(
        {
          status: "error",
          error: "Personal API keys cannot specify account_id",
        },
        { status: 403, headers: getCorsHeaders() },
      );
    }
    responseAccountIds = [accountId];
  }

  return { accountId: updateAccountId, active, responseAccountIds };
}
