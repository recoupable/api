import supabase from "../serverClient";

/**
 * Select the catalogs linked to any of `accountIds` via `account_catalogs`,
 * ordered by `created_at desc`.
 *
 * Takes owner ids and nothing else — it does not resolve organization membership.
 * Callers pass the owners they want, which for a catalog read is
 * `getCatalogOwnerIds(accountId)`: the account plus its organizations (chat#1938).
 *
 * A catalog linked by more than one of the given owners is returned once.
 *
 * @param accountIds - Owner account ids to read catalogs for
 * @throws Error if the query fails
 */
export async function selectAccountCatalogs(accountIds: string[]) {
  if (!accountIds.length) return [];

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
    .in("account", accountIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch account_catalogs: ${error.message}`);
  }

  const catalogs = (data ?? []).map(row => row.catalogs);
  return [...new Map(catalogs.map(catalog => [catalog.id, catalog])).values()];
}
