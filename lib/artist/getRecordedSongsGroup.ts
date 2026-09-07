import { getLatestProfileMeasurementAt } from "@/lib/artist/getLatestProfileMeasurementAt";

/** Build a display-only group for measured credits without creating a saved catalog. */
export async function getRecordedSongsGroup({
  artistId,
  isrcs,
  catalogSongRows,
  songRecords,
  plays,
}: {
  artistId: string;
  isrcs: string[];
  catalogSongRows: Array<{ catalog: string; song: string }>;
  songRecords: Array<{ isrc: string }>;
  plays: Record<string, number>;
}) {
  const cataloged = new Set(catalogSongRows.map(row => row.song));
  const recorded = new Set(songRecords.map(song => song.isrc));
  const songs = isrcs.filter(isrc => !cataloged.has(isrc) && recorded.has(isrc) && isrc in plays);
  if (!songs.length) return null;
  try {
    const updated_at = await getLatestProfileMeasurementAt(songs);
    if (!updated_at) return null;
    return {
      id: artistId,
      name: "Recorded songs",
      song_count: songs.length,
      updated_at,
      catalogSongRows: songs.map(song => ({ catalog: artistId, song })),
    };
  } catch (error) {
    console.error("Error loading recorded songs for public profile:", error);
    return null;
  }
}
