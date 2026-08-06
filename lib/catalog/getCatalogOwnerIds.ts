import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

/**
 * The account ids whose catalogs are visible to `accountId`: the account itself,
 * plus every organization it belongs to (chat#1938).
 *
 * An organization is itself a row in `accounts`, so an org-owned catalog is just
 * an `account_catalogs` row whose `account` is the organization id. Resolving
 * membership here — rather than duplicating a link row per member at write time —
 * means access follows the org as people join and leave.
 *
 * This is the one place that turns an account into a set of catalog owners, so
 * the `account_catalogs` selectors stay pure id lookups and every catalog read
 * path can share the same definition of "visible".
 *
 * The account is always first, and ids are unique.
 *
 * @param accountId - The authenticated account
 * @returns Owner account ids, starting with `accountId`
 */
export async function getCatalogOwnerIds(accountId: string): Promise<string[]> {
  const organizations = await getAccountOrganizations({ accountId });

  const organizationIds = organizations
    .map(organization => organization.organization_id)
    .filter((id): id is string => Boolean(id));

  return [...new Set([accountId, ...organizationIds])];
}
