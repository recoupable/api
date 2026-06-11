import { selectSongIdentifiers } from "@/lib/supabase/song_identifiers/selectSongIdentifiers";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";

export type SnapshotInput = {
  catalog_id?: string;
  album_ids?: string[];
  isrcs?: string[];
};

/**
 * Resolve a snapshot input (catalog | album ids | ISRCs) to a deduped list of
 * Spotify album ids. Catalogs resolve through their songs; ISRCs through the
 * album_id identifier mappings.
 *
 * @param input - Exactly one of catalog_id / album_ids / isrcs
 * @returns Unique Spotify album ids ([] when nothing is mapped yet)
 */
export async function resolveSnapshotAlbums(input: SnapshotInput): Promise<string[]> {
  if (input.album_ids) return [...new Set(input.album_ids)];

  let isrcs = input.isrcs ?? [];
  if (input.catalog_id) {
    const { songs } = await selectCatalogSongsWithArtists({ catalogId: input.catalog_id });
    isrcs = songs.map(row => row.isrc);
  }

  const identifiers = await selectSongIdentifiers({
    platform: "spotify",
    identifierType: "album_id",
    songs: isrcs,
  });
  return [...new Set(identifiers.map(row => row.value))];
}
