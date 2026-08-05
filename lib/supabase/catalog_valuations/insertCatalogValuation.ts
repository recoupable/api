import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Insert one valuation history row for a catalog — the persisted output of
 * computeValuationBand at the moment it was computed (chat#1889 row 15).
 *
 * @param row - The valuation row (catalog_id, band, aggregates)
 * @returns The inserted row, or null on error
 */
export async function insertCatalogValuation(
  row: TablesInsert<"catalog_valuations">,
): Promise<Tables<"catalog_valuations"> | null> {
  const { data, error } = await supabase.from("catalog_valuations").insert(row).select().single();

  if (error) {
    console.error("Error inserting catalog_valuations:", error);
    return null;
  }

  return data;
}
