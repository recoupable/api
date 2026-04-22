import supabase from "../serverClient";

/**
 * Chunked fetch (100 ids per `.in()` call) to stay under Supabase's URL length
 * limit on large id sets. A failing chunk is logged and skipped so a single
 * bad chunk does not nuke an otherwise-valid response.
 */
export async function selectPostsByIds(postIds: string[]) {
  if (!postIds.length) {
    return [];
  }

  const chunkSize = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < postIds.length; i += chunkSize) {
    chunks.push(postIds.slice(i, i + chunkSize));
  }

  const fetchChunk = async (chunk: string[]) => {
    const { data, error } = await supabase.from("posts").select("*").in("id", chunk);
    if (error) {
      console.error("[ERROR] selectPostsByIds chunk failed:", { error, chunkSize: chunk.length });
      return [];
    }
    return data ?? [];
  };

  const firstChunk = await fetchChunk(chunks[0]);
  const all: typeof firstChunk = [...firstChunk];
  for (let i = 1; i < chunks.length; i++) {
    const rows = await fetchChunk(chunks[i]);
    all.push(...rows);
  }
  return all;
}
