import supabase from "../serverClient";

const POST_ID_CHUNK_SIZE = 100;

/**
 * Chunked at 100 ids per `.in()` call to stay under PostgREST's URL parse
 * limit when fetching large pages of posts.
 */
export async function selectPostsByIds(postIds: string[]) {
  if (!postIds.length) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < postIds.length; i += POST_ID_CHUNK_SIZE) {
    chunks.push(postIds.slice(i, i + POST_ID_CHUNK_SIZE));
  }

  const all: Awaited<ReturnType<typeof fetchChunk>> = [];
  for (const chunk of chunks) {
    const rows = await fetchChunk(chunk);
    all.push(...rows);
  }
  return all;
}

async function fetchChunk(chunk: string[]) {
  const { data, error } = await supabase.from("posts").select("*").in("id", chunk);
  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }
  return data ?? [];
}
