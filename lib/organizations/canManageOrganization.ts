import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { isRecoupAdmin } from "@/lib/organizations/isRecoupAdmin";

export interface CanManageOrganizationParams {
  /** The authenticated account ID */
  accountId: string;
  /** The organization being managed */
  organizationId: string;
}

/**
 * Checks if an account can manage an organization's settings
 * (e.g. domain mappings).
 *
 * Access rules:
 * - Members of the organization (or the org account itself) are allowed
 * - Recoup admins are allowed for any organization
 *
 * @param params - The validation parameters
 * @returns true if access is allowed, false otherwise
 */
export async function canManageOrganization(params: CanManageOrganizationParams): Promise<boolean> {
  if (await validateOrganizationAccess(params)) {
    return true;
  }

  return isRecoupAdmin(params.accountId);
}
