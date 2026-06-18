import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * Inserts a new `catalogs` row and returns it.
 *
 * @param name - Display name for the catalog
 * @returns The inserted catalog row
 * @throws Error if the insert fails
 */
export async function insertCatalog(name: string): Promise<Tables<"catalogs">> {
  const { data, error } = await supabase.from("catalogs").insert({ name }).select().single();

  if (error || !data) {
    throw new Error(`Failed to insert catalog: ${error?.message ?? "no row returned"}`);
  }

  return data;
}
