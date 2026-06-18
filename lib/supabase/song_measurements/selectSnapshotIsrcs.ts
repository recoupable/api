import supabase from "../serverClient";

/**
 * Returns the distinct ISRCs that were measured for a snapshot — the tracks
 * that actually landed play counts in `song_measurements` for this run. This is
 * the source of truth for a snapshot's tracks: the snapshot's own `isrcs`
 * column is only set for ISRC-scoped runs, whereas valuations are album-scoped.
 *
 * @param snapshotId - The snapshot id (lineage on `song_measurements.snapshot`)
 * @returns Distinct ISRC strings, or [] if none exist or on error
 */
export async function selectSnapshotIsrcs(snapshotId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("song_measurements")
    .select("song")
    .eq("snapshot", snapshotId);

  if (error) {
    console.error("Error fetching snapshot ISRCs:", error);
    return [];
  }

  return [...new Set((data ?? []).map(row => row.song))];
}
