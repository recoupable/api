import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";

export interface CatalogSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GetCatalogsForAccountsResult {
  status: "success";
  catalogs: CatalogSummary[];
}

/**
 * Retrieves the catalogs linked to the supplied accounts.
 *
 * Joins `account_catalogs` -> `catalogs` via `selectAccountCatalogs`
 * (ordered by `created_at desc`) and flattens each row to the wire shape
 * `{ id, name, created_at, updated_at }`. Byte-identical to the legacy
 * `Recoup-Agent-APIs/lib/catalogs/getCatalogsForAccounts.ts` response.
 *
 * @param accountIds - Account IDs to look up catalogs for
 * @returns `{ status: "success", catalogs }` — empty array when no matches
 */
export async function getCatalogsForAccounts(
  accountIds: string[],
): Promise<GetCatalogsForAccountsResult> {
  const rows = await selectAccountCatalogs({ accountIds });

  const catalogs: CatalogSummary[] = (rows ?? []).flatMap(row => {
    // `catalogs` is declared as an array by the supabase helper's hand-written
    // type, but an `!inner` join on a 1:1 relation can surface as a single
    // object at runtime. Normalise both shapes.
    const related = row.catalogs;
    const list = Array.isArray(related) ? related : related ? [related] : [];
    return list.map(catalog => ({
      id: catalog.id,
      name: catalog.name,
      created_at: catalog.created_at,
      updated_at: catalog.updated_at,
    }));
  });

  return {
    status: "success",
    catalogs,
  };
}

export default getCatalogsForAccounts;
