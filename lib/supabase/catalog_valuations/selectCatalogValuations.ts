import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select one catalog's valuation history, latest-first. limit=1 is the
 * current value; larger limits return the series for trend rendering.
 *
 * @param params.catalogId - The catalog whose history to read
 * @param params.limit - Max rows to return (route default 30, max 100)
 * @returns The rows latest-first (possibly empty), or null on error
 */
export async function selectCatalogValuations({
  catalogId,
  limit,
}: {
  catalogId: string;
  limit: number;
}): Promise<Tables<"catalog_valuations">[] | null> {
  const { data, error } = await supabase
    .from("catalog_valuations")
    .select("*")
    .eq("catalog_id", catalogId)
    .order("measured_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching catalog_valuations:", error);
    return null;
  }

  return data || [];
}
