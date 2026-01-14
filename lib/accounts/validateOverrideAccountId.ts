import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

export type ValidateOverrideAccountIdParams = {
  apiKey: string | null;
  targetAccountId: string;
};

export type ValidateOverrideAccountIdResult = {
  accountId: string;
};

/**
 * Validates that an API key has permission to override to a target accountId.
 *
 * Used when an org API key wants to create resources on behalf of another account.
 * Checks that the API key belongs to an org with access to the target account.
 *
 * @param params.apiKey - The x-api-key header value
 * @param params.targetAccountId - The accountId to override to
 * @param root0
 * @param root0.apiKey
 * @param root0.targetAccountId
 * @returns The validated accountId or a NextResponse error
 */
export async function validateOverrideAccountId({
  apiKey,
  targetAccountId,
}: ValidateOverrideAccountIdParams): Promise<NextResponse | ValidateOverrideAccountIdResult> {
  if (!apiKey) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to validate API key",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }

  const keyDetails = await getApiKeyDetails(apiKey);
  if (!keyDetails) {
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to validate API key",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasAccess = await canAccessAccount({
    orgId: keyDetails.orgId,
    targetAccountId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      {
        status: "error",
        message: "Access denied to specified accountId",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return { accountId: targetAccountId };
}
