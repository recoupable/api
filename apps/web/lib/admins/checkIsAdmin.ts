import { RECOUP_ORG_ID } from "@/lib/const";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

/**
 * Checks if an account is a Recoup admin by verifying
 * membership in the Recoup organization.
 *
 * @param accountId - The account ID to check
 * @returns true if the account is a member of the Recoup org
 */
export async function checkIsAdmin(accountId: string): Promise<boolean> {
  return validateOrganizationAccess({
    accountId,
    organizationId: RECOUP_ORG_ID,
  });
}
