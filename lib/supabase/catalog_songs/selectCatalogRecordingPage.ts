import supabase from "../serverClient";

/**
 * Read current catalog recordings, including those with no measurements or current roster artist.
 * @param params - Catalog and bounded pagination.
 * @throws Error on failure; never substitutes an empty catalog for an unavailable database.
 */
export async function selectCatalogRecordingPage(params: {
  catalogId: string;
  page: number;
  limit: number;
}) {
  const { data, count, error } = await supabase
    .from("catalog_songs")
    .select("song,songs!inner(isrc,name)", { count: "exact" })
    .eq("catalog", params.catalogId)
    .order("song", { ascending: true })
    .range((params.page - 1) * params.limit, params.page * params.limit - 1);
  if (error || count === null) throw new Error("Catalog membership unavailable");
  const songs = (data ?? []).map(
    row => row.songs as unknown as { isrc: string; name: string | null },
  );
  return { songs, total_count: count };
}
