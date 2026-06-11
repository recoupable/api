import {
  fetchSpotifyAlbumPlayCounts,
  FetchSpotifyAlbumPlayCountsResult,
} from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";

/**
 * Run the play-count actor for one chunk of albums. Isolated as its own step
 * so the runtime persists the (paid) actor result — mapping retries in the
 * next step replay against this cached payload instead of re-spending.
 *
 * @param albumIds - Album ids in this chunk
 * @returns The actor run id + parsed album items (serializable)
 */
export async function fetchChunkStep(
  albumIds: string[],
): Promise<FetchSpotifyAlbumPlayCountsResult> {
  "use step";
  return fetchSpotifyAlbumPlayCounts(albumIds);
}
