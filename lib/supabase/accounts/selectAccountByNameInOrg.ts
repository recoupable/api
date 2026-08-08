import supabase from "../serverClient";

interface AccountMatch {
  id: string;
  name: string;
}

/**
 * Finds accounts by name within an organization using case-insensitive partial matching.
 *
 * @param organizationId - The organization to search within
 * @param name - The artist name to search for
 * @returns Matching accounts (id and name), or empty array if none found
 */
export async function selectAccountByNameInOrg(
  organizationId: string,
  name: string,
): Promise<AccountMatch[]> {
  const { data, error } = await supabase
    .from("account_organization_ids")
    .select("account:accounts!account_organization_ids_account_id_fkey ( id, name )")
    .eq("organization_id", organizationId)
    .ilike("account.name", `%${name}%`);

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as { account: AccountMatch | null }[];
  return rows.filter(row => row.account !== null).map(row => row.account as AccountMatch);
}
