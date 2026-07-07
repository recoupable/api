import {
  selectCatalogSongTitles,
  type CatalogSongTitle,
} from "@/lib/supabase/catalog_songs/selectCatalogSongTitles";
import { selectSongArtistIsrcs } from "@/lib/supabase/song_artists/selectSongArtistIsrcs";

/**
 * Resolve the songs a catalog measurements read covers: the whole catalog,
 * or — when an artist filter is applied — only the catalog's songs linked
 * to that artist account (catalog_songs ∩ song_artists). Songs the artist
 * is linked to outside the catalog never leak in.
 *
 * @param params.catalogId - The catalog to list songs for
 * @param params.artistAccountId - Optional artist account to scope the read to
 * @returns ISRC + title pairs in scope, or [] when nothing matches
 */
export async function resolveCatalogSongsInScope({
  catalogId,
  artistAccountId,
}: {
  catalogId: string;
  artistAccountId?: string;
}): Promise<CatalogSongTitle[]> {
  const songs = await selectCatalogSongTitles(catalogId);
  if (!artistAccountId) return songs;

  const artistIsrcs = new Set(await selectSongArtistIsrcs(artistAccountId));
  return songs.filter(song => artistIsrcs.has(song.isrc));
}
