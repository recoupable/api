import supabase from "../serverClient";
import { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Updates a `catalogs` row and returns it, or null when no row has that id.
 *
 * `updated_at` is maintained by the table's `set_updated_at` trigger, so
 * callers pass only the fields they mean to change.
 *
 * @param id - Catalog id
 * @param fields - Fields to update
 * @returns The updated catalog row, or null if no catalog has that id
 * @throws Error if the update fails
 */
export async function updateCatalog(
  id: string,
  fields: TablesUpdate<"catalogs">,
): Promise<Tables<"catalogs"> | null> {
  const { data, error } = await supabase
    .from("catalogs")
    .update(fields)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update catalog: ${error.message}`);
  }

  return data;
}
