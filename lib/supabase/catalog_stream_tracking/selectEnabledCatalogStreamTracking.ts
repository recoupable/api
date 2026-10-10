import supabase from "../serverClient";
/** Cursor pagination over opted-in catalogs; no arbitrary roster filter. */
export async function selectEnabledCatalogStreamTracking(after?: string) {
  let query = supabase
    .from("catalog_stream_tracking")
    .select("catalog_id")
    .eq("enabled", true)
    .order("catalog_id")
    .limit(100);
  if (after) query = query.gt("catalog_id", after);
  const { data, error } = await query;
  if (error) throw new Error("Catalog stream subscriptions unavailable");
  return data ?? [];
}
