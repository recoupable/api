import { fetchSpotifyAlbumPlayCounts } from "@/lib/apify/spotify/fetchSpotifyAlbumPlayCounts";
import { writeAlbumPlayCounts } from "@/lib/research/playcounts/writeAlbumPlayCounts";

/**
 * Capture one chunk of albums for a snapshot job: one actor call for the
 * chunk, measurements written with run + snapshot lineage. A step so each
 * chunk retries independently and its result is persisted for replay.
 *
 * @param snapshotId - The snapshot job id (lineage)
 * @param albumIds - Album ids in this chunk
 * @returns Number of measurements written
 */
export async function captureSnapshotChunkStep(
  snapshotId: string,
  albumIds: string[],
): Promise<number> {
  "use step";
  const { runId, albums } = await fetchSpotifyAlbumPlayCounts(albumIds);
  return writeAlbumPlayCounts(albums, runId, { snapshotId });
}
