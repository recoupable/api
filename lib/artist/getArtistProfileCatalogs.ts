import { selectCatalogsBySongs } from "@/lib/supabase/catalog_songs/selectCatalogsBySongs";
import { getCatalogSongs } from "@/lib/songs/getCatalogSongs";
import { getCatalogEarliestReleaseDate } from "@/lib/catalog/getCatalogEarliestReleaseDate";
import { buildProfileSongs, type ProfileSong } from "./buildProfileSongs";

/** Optional catalog metadata for existing profile consumers; never selects artist songs. */
export async function getArtistProfileCatalogs(songs: ProfileSong[]) {
  const isrcs = songs.map(song => song.isrc);
  const [catalogRows, catalogSongRows] = await Promise.all([
    selectCatalogsBySongs(isrcs),
    getCatalogSongs(isrcs),
  ]);
  const earliestEntries = await Promise.all(
    catalogRows.map(
      async catalog => [catalog.id, await getCatalogEarliestReleaseDate(catalog.id)] as const,
    ),
  );
  const { songsByCatalog, valuation } = buildProfileSongs({
    catalogSongRows,
    songs,
    plays: Object.fromEntries(songs.map(song => [song.isrc, song.plays])),
    artwork: {},
    earliestReleaseDates: Object.fromEntries(earliestEntries),
  });
  return {
    catalogs: catalogRows.map(catalog => ({
      id: catalog.id,
      name: catalog.name,
      song_count: songsByCatalog[catalog.id]?.length ?? 0,
      updated_at: catalog.updated_at,
      songs: songsByCatalog[catalog.id] ?? [],
    })),
    valuation,
  };
}
