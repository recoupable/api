import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select the account_catalogs link for a catalog against a set of owner ids — the
 * ownership check for catalog reads (no IDOR: a catalog owned by nobody in
 * `accountIds` returns null, indistinguishable from not existing).
 *
 * Takes owner ids and nothing else — it does not resolve organization membership.
 * Callers pass `getCatalogOwnerIds(accountId)` so that a catalog surfaced by the
 * catalog list can also be opened: both paths share one definition of "visible"
 * (chat#1938).
 *
 * Capped at one row, since a catalog owned both directly and through an
 * organization has two link rows and only its existence matters here.
 *
 * @param params.accountIds - Owner account ids the catalog may belong to
 * @param params.catalogId - The catalog to check
 * @returns A link row, or null when absent or on error
 */
export async function selectAccountCatalog({
  accountIds,
  catalogId,
}: {
  accountIds: string[];
  catalogId: string;
}): Promise<Tables<"account_catalogs"> | null> {
  if (!accountIds.length) return null;

  const { data, error } = await supabase
    .from("account_catalogs")
    .select("*")
    .in("account", accountIds)
    .eq("catalog", catalogId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching account_catalogs:", error);
    return null;
  }

  return data;
}
