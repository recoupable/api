import supabase from "../serverClient";
/** Load an immutable source window and subscription revision. */
export async function selectCatalogStreamRun(id: string) {
  const { data, error } = await supabase
    .from("catalog_stream_runs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error("Catalog stream run unavailable");
  return data;
}
