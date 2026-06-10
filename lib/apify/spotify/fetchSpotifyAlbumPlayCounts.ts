import apifyClient from "@/lib/apify/client";

const PLAY_COUNT_ACTOR = "beatanalytics~spotify-play-count-scraper";

export type SpotifyAlbumPlayCounts = {
  name?: string;
  label?: string;
  copyright?: string;
  tracks?: Array<{ id: string; name?: string; streamCount?: number; duration?: number }>;
};

export type FetchSpotifyAlbumPlayCountsResult = {
  runId: string;
  albums: SpotifyAlbumPlayCounts[];
};

/**
 * Run the Spotify play-count actor for one or more albums and return the
 * per-album track play counts. One album call captures all of its tracks;
 * the actor reads platform-displayed counts (not royalty-bearing streams).
 *
 * @param spotifyAlbumIds - Spotify album ids to capture
 * @returns The actor run id (for raw-payload lineage) and parsed album items
 * @throws Error on empty input or a failed actor run
 */
export async function fetchSpotifyAlbumPlayCounts(
  spotifyAlbumIds: string[],
): Promise<FetchSpotifyAlbumPlayCountsResult> {
  if (spotifyAlbumIds.length === 0) {
    throw new Error("At least one Spotify album id is required");
  }

  const input = {
    urls: spotifyAlbumIds.map(id => ({ url: `https://open.spotify.com/album/${id}` })),
  };

  const run = await apifyClient.actor(PLAY_COUNT_ACTOR).call(input);

  if (!run?.id || !run?.defaultDatasetId || run.status !== "SUCCEEDED") {
    throw new Error(`Spotify play-count actor run failed with status ${run?.status}`);
  }

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return { runId: run.id, albums: items as SpotifyAlbumPlayCounts[] };
}
