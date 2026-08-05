import supabase from "../serverClient";
import { getAccountOrganizations } from "../account_organization_ids/getAccountOrganizations";

/**
 * Select the catalogs visible to an account via `account_catalogs`, ordered by
 * `created_at desc`.
 *
 * Visibility is the account's own catalogs plus those owned by any organization
 * it belongs to. An organization is itself a row in `accounts`, so an org-owned
 * catalog is just an `account_catalogs` row whose `account` is the organization
 * id. Membership is resolved here at read time rather than duplicated per member
 * at write time, so access follows the org as people join and leave (chat#1938).
 *
 * A catalog owned both directly and through an organization is returned once.
 *
 * @throws Error if the query fails
 */
export async function selectAccountCatalogs(accountId: string) {
  const organizations = await getAccountOrganizations({ accountId });
  const ownerIds = [
    ...new Set([
      accountId,
      ...organizations.map(o => o.organization_id).filter((id): id is string => Boolean(id)),
    ]),
  ];

  const { data, error } = await supabase
    .from("account_catalogs")
    .select(
      `
    catalogs!inner (
      id,
      name,
      created_at,
      updated_at
    )
  `,
    )
    .in("account", ownerIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch account_catalogs: ${error.message}`);
  }

  const catalogs = (data ?? []).map(row => row.catalogs);
  return [...new Map(catalogs.map(c => [c.id, c])).values()];
}
