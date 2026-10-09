import supabase from "../serverClient";
/** Read latest source versions in SQL; correction history cannot cause PostgREST truncation. */
export async function selectCatalogStreamObservations(input: {
  catalogId: string;
  isrc: string;
  since: string;
  until: string;
}) {
  const { data, error } = await supabase.rpc("read_catalog_stream_days", {
    p_catalog_id: input.catalogId,
    p_isrc: input.isrc,
    p_since: input.since,
    p_until: input.until,
  });
  if (error) throw new Error("Catalog stream history unavailable");
  return data ?? [];
}
