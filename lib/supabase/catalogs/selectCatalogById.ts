import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Selects a single `catalogs` row by id, or null if none exists.
 *
 * @param id - Catalog id
 * @returns The catalog row, or null if not found
 * @throws Error if the query fails
 */
export async function selectCatalogById(id: string): Promise<Tables<"catalogs"> | null> {
  const { data, error } = await supabase.from("catalogs").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch catalog: ${error.message}`);
  }

  return data;
}
