import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { isRecoupAdmin } from "@/lib/organizations/isRecoupAdmin";

export interface CanManageOrgMembersParams {
  /** The authenticated caller's account ID */
  accountId: string;
  /** The organization being managed */
  organizationId: string;
}

/**
 * Checks whether a caller may manage an organization's membership
 * (add or remove members).
 *
 * Access rules:
 * 1. The caller is the organization itself or one of its members
 * 2. Otherwise, the caller is a Recoup admin
 *
 * @param params - The validation parameters
 * @returns true if the caller may manage members, false otherwise
 */
export async function canManageOrgMembers(params: CanManageOrgMembersParams): Promise<boolean> {
  if (await validateOrganizationAccess(params)) {
    return true;
  }

  return isRecoupAdmin(params.accountId);
}
