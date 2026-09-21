import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { SiteError } from "./SiteError";
export async function authorizeSiteWorkspace(accountId: string, organizationId?: string | null) {
  if (!accountId) throw new SiteError(401, "Authentication required");
  const ownerId = organizationId || accountId;
  if (
    ownerId !== accountId &&
    !(await validateOrganizationAccess({ accountId, organizationId: ownerId }))
  )
    throw new SiteError(403, "Workspace not available");
  return ownerId;
}
