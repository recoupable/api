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
 * Validate Override Account Id.
 *
 * @param root0 - Input object.
 * @param root0.apiKey - Value for root0.apiKey.
 * @param root0.targetAccountId - Value for root0.targetAccountId.
 * @returns - Computed result.
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
    currentAccountId: keyDetails.accountId,
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
