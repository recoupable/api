import { z } from "zod";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

/** Resolve a namespaced scope from authenticated identity and current organization access. */
export async function authorizeIngestionScope(
  actor: string,
  organization?: string,
): Promise<string> {
  z.uuid().parse(actor);
  if (!organization) return `account/${actor.toLowerCase()}`;
  z.uuid().parse(organization);
  if (!(await validateOrganizationAccess({ accountId: actor, organizationId: organization })))
    throw new Error("Access denied");
  return `organization/${organization.toLowerCase()}`;
}
