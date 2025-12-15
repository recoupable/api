import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getApiKeys } from "@/lib/supabase/account_api_keys/getApiKeys";
import { onlyOrgAccounts } from "./onlyOrgAccounts";

/**
 * Internal helper to fetch API keys scoped to an organization.
 * Validates that the authenticated account is a member of the organization
 * before returning keys.
 *
 * @param accountId - The authenticated account ID
 * @param organizationId - The organization ID whose keys are requested
 * @returns NextResponse with keys or an error response
 */
export async function getOrgApiKeysHandler(
  accountId: string,
  organizationId: string,
): Promise<NextResponse> {
  // Verify membership before returning org keys
  const membershipError = await onlyOrgAccounts(accountId, organizationId);
  if (membershipError) {
    return membershipError;
  }

  const { data, error } = await getApiKeys({ accountId: organizationId });

  if (error) {
    console.error("Error fetching organization API keys:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to fetch organization API keys",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }

  return NextResponse.json(
    {
      keys: data || [],
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
