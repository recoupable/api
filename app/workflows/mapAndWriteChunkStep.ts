import { RetryableError } from "workflow";
import { writeAlbumPlayCounts } from "@/lib/research/playcounts/writeAlbumPlayCounts";
import { FetchSpotifyAlbumPlayCountsResult } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";
import { SpotifyRateLimitError } from "@/lib/spotify/SpotifyRateLimitError";

/**
 * Map + write one chunk's captured albums against the previous step's cached
 * actor payload. Sustained Spotify rate limiting escalates to a durable
 * RetryableError — the runtime suspends and reschedules this step without
 * re-running the actor (its result is memoized in {@link fetchChunkStep}).
 *
 * @param snapshotId - The snapshot job id (lineage)
 * @param payload - The cached actor result for this chunk
 * @returns Number of measurements written
 */
export async function mapAndWriteChunkStep(
  snapshotId: string,
  payload: FetchSpotifyAlbumPlayCountsResult,
): Promise<number> {
  "use step";
  try {
    return await writeAlbumPlayCounts(payload.albums, payload.runId, { snapshotId });
  } catch (error) {
    if (error instanceof SpotifyRateLimitError) {
      throw new RetryableError("Spotify rate limited during identifier mapping", {
        retryAfter: "30s",
      });
    }
    throw error;
  }
}
