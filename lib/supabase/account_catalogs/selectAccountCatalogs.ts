import supabase from "../serverClient";

/**
 * Select catalogs linked to an account via `account_catalogs`, ordered by
 * `created_at desc`.
 *
 * @throws Error if the query fails
 */
export async function selectAccountCatalogs(accountId: string) {
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
    .eq("account", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch account_catalogs: ${error.message}`);
  }

  return (data ?? []).map(row => row.catalogs);
}
