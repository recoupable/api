import { NextResponse } from "next/server";
import { createKey } from "@/lib/keys/createKey";
import { onlyOrgAccounts } from "./onlyOrgAccounts";

/**
 * Internal helper to create an API key scoped to an organization.
 * Validates that the authenticated account is a member of the organization
 * before creating the key.
 *
 * @param accountId - The authenticated account ID
 * @param organizationId - The organization ID to create the key for
 * @param keyName - The name for the API key
 * @returns NextResponse with the generated key or an error response
 */
export async function createOrgApiKeysHandler(
  accountId: string,
  organizationId: string,
  keyName: string,
): Promise<NextResponse> {
  // Verify membership before creating org key
  const membershipError = await onlyOrgAccounts(accountId, organizationId);
  if (membershipError) {
    return membershipError;
  }

  // Create key owned by the organization
  return createKey(organizationId, keyName);
}
