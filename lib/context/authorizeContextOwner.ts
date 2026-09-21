import { z } from "zod";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

/** Recheck the authenticated actor's scope at every sensitive domain operation. */
export async function authorizeContextOwner(accountId: string, organizationId?: string) {
  z.string().uuid().parse(accountId);
  if (organizationId) {
    z.string().uuid().parse(organizationId);
    if (!(await validateOrganizationAccess({ accountId, organizationId })))
      throw new Error("Access denied to context owner");
  }
  return {
    accountId,
    ownerId: organizationId ?? accountId,
    organizationId: organizationId ?? null,
  };
}
