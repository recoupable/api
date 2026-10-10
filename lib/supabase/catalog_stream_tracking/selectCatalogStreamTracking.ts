import supabase from "../serverClient";
/** Read tracking state; unavailable storage must not appear disabled. */
export async function selectCatalogStreamTracking(catalogId: string) {
  const { data, error } = await supabase
    .from("catalog_stream_tracking")
    .select("*")
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (error) throw new Error("Catalog stream tracking unavailable");
  return data;
}
