import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select the account_catalogs link for one account + catalog pair — the
 * ownership check for catalog reads (no IDOR: a catalog owned by another
 * account returns null, indistinguishable from not existing).
 *
 * @param params.accountId - The authenticated account
 * @param params.catalogId - The catalog to check
 * @returns The link row, or null when absent or on error
 */
export async function selectAccountCatalog({
  accountId,
  catalogId,
}: {
  accountId: string;
  catalogId: string;
}): Promise<Tables<"account_catalogs"> | null> {
  const { data, error } = await supabase
    .from("account_catalogs")
    .select("*")
    .eq("account", accountId)
    .eq("catalog", catalogId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching account_catalogs:", error);
    return null;
  }

  return data;
}
