import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import type { CreateMeasurementJobBody } from "./validateCreateMeasurementJobRequest";

/**
 * Resolve a measurement-job `scope` to a deduped list of song ISRCs.
 * `isrcs` pass through; `album_ids` resolve through the album_id identifier
 * mappings; `catalog_id` resolves through its songs. Mirrors
 * {@link resolveSnapshotAlbums} but returns songs (the backfill queue is keyed
 * by ISRC).
 *
 * @param scope - Exactly one of catalog_id / album_ids / isrcs
 * @returns Unique song ISRCs ([] when nothing is mapped yet)
 */
export async function resolveScopeSongs(
  scope: CreateMeasurementJobBody["scope"],
): Promise<string[]> {
  if (scope.isrcs) return [...new Set(scope.isrcs)];

  if (scope.album_ids) {
    const rows = await selectSongIdentifiers({
      platform: "spotify",
      identifierType: "album_id",
      values: scope.album_ids,
    });
    return [...new Set(rows.map(r => r.song))];
  }

  if (scope.catalog_id) {
    const { songs } = await selectCatalogSongsWithArtists({ catalogId: scope.catalog_id });
    return [...new Set(songs.map(s => s.isrc))];
  }

  return [];
}
