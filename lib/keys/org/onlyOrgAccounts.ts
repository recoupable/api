import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

/**
 * Validates that an account is a member of the specified organization.
 * Returns an error response if validation fails, or null if validation passes.
 *
 * @param accountId - The account ID to validate
 * @param organizationId - The organization ID to check membership for
 * @returns NextResponse with 403 error if not a member, or null if member
 */
export async function onlyOrgAccounts(
  accountId: string,
  organizationId: string,
): Promise<NextResponse | null> {
  const orgMemberships = await getAccountOrganizations({
    accountId,
    organizationId,
  });

  if (!orgMemberships.length) {
    return NextResponse.json(
      {
        status: "error",
        message: "Account is not a member of this organization",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return null;
}
