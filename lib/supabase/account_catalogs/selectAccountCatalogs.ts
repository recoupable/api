import supabase from "../serverClient";

export interface CatalogSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Select catalogs linked to an account via `account_catalogs`, ordered by
 * `created_at desc`. Returns the flat catalog shape used by callers.
 *
 * @throws Error if the query fails
 */
export async function selectAccountCatalogs(accountId: string): Promise<CatalogSummary[]> {
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

  return (data ?? []).flatMap(row => {
    // `catalogs` is declared as an array by the supabase helper's generated
    // type, but an `!inner` join on a 1:1 relation can surface as a single
    // object at runtime. Normalise both shapes.
    const related = row.catalogs as unknown;
    const list = Array.isArray(related) ? related : related ? [related] : [];
    return list as CatalogSummary[];
  });
}
