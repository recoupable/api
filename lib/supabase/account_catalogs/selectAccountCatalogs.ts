import supabase from "../serverClient";

export type AccountCatalog = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  /**
   * Which of the requested `accountIds` link this catalog. Usually one; two when
   * a catalog is owned directly and through an organization. Only ever accounts
   * the caller asked about, so a response built from this cannot name an owner
   * the caller reads nothing through.
   */
  owners: string[];
};

/**
 * Select the catalogs linked to any of `accountIds` via `account_catalogs`,
 * ordered by `created_at desc`.
 *
 * Takes owner ids and nothing else — it does not resolve organization membership.
 * Callers pass the owners they want, which for a catalog read is
 * `getCatalogOwnerIds(accountId)`: the account plus its organizations (chat#1938).
 *
 * A catalog linked by more than one of the given owners is returned once, with
 * every matching owner in `owners`.
 *
 * @param accountIds - Owner account ids to read catalogs for
 * @param options.catalogIds - Optional narrowing to specific catalogs, for
 *   callers that already have the ids and only need their ownership
 * @throws Error if the query fails
 */
export async function selectAccountCatalogs(
  accountIds: string[],
  options: { catalogIds?: string[] } = {},
): Promise<AccountCatalog[]> {
  if (!accountIds.length) return [];
  if (options.catalogIds && !options.catalogIds.length) return [];

  let query = supabase
    .from("account_catalogs")
    .select(
      `
    account,
    catalogs!inner (
      id,
      name,
      created_at,
      updated_at
    )
  `,
    )
    .in("account", accountIds);

  if (options.catalogIds) {
    query = query.in("catalog", options.catalogIds);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch account_catalogs: ${error.message}`);
  }

  const byId = new Map<string, AccountCatalog>();
  for (const row of data ?? []) {
    const existing = byId.get(row.catalogs.id);
    if (existing) {
      if (!existing.owners.includes(row.account)) existing.owners.push(row.account);
      continue;
    }
    byId.set(row.catalogs.id, { ...row.catalogs, owners: [row.account] });
  }
  return [...byId.values()];
}
