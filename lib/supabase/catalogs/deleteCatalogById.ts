import supabase from "../serverClient";

/**
 * Deletes a `catalogs` row and returns its id, or null when no row had that id.
 *
 * The related rows are handled by the schema's foreign keys, not here:
 * `catalog_songs`, `account_catalogs` and `catalog_valuations` cascade, while
 * `playcount_snapshots.catalog` is `ON DELETE SET NULL` — the metered
 * measurement survives the catalog it produced.
 *
 * @param id - Catalog id
 * @returns The deleted catalog id, or null if no catalog had that id
 * @throws Error if the delete fails
 */
export async function deleteCatalogById(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("catalogs")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete catalog: ${error.message}`);
  }

  return data?.id ?? null;
}
