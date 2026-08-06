import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * The `account_catalogs` links for a set of catalogs — which accounts own each
 * one. The catalog reads go the other way (owners → catalogs, via
 * `selectAccountCatalogs`); this is the lookup a response needs when it has to
 * name the owner it already resolved a catalog through.
 *
 * A catalog can carry several links (owned directly and through an
 * organization), so the caller decides which one to surface.
 *
 * @param catalogIds - The catalogs to read ownership for
 * @returns The link rows, or [] when no catalogs were asked for
 * @throws Error if the query fails
 */
export async function selectCatalogOwnerLinks(
  catalogIds: string[],
): Promise<Tables<"account_catalogs">[]> {
  if (!catalogIds.length) return [];

  const { data, error } = await supabase
    .from("account_catalogs")
    .select("*")
    .in("catalog", catalogIds);

  if (error) {
    throw new Error(`Failed to fetch catalog owner links: ${error.message}`);
  }

  return data ?? [];
}
