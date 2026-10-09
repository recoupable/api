import supabase from "../serverClient";
/** Latest attempt includes failed and partial coverage, not only successes. */
export async function selectLatestCatalogStreamRun(catalogId: string) {
  const { data, error } = await supabase
    .from("catalog_stream_runs")
    .select("*")
    .eq("catalog_id", catalogId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Catalog stream run status unavailable");
  return data;
}
