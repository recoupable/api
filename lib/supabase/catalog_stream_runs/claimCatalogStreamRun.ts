import supabase from "../serverClient";
/** Atomically claim at most one run per subscription revision and UTC day. */
export async function claimCatalogStreamRun(catalogId: string, day: string) {
  const { data, error } = await supabase.rpc("claim_catalog_stream_run", {
    p_catalog_id: catalogId,
    p_day: day,
  });
  if (error) throw new Error("Unable to claim catalog stream run");
  return data?.[0] ?? null;
}
