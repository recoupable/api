import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";
import { selectCatalogsBySongs } from "@/lib/supabase/catalog_songs/selectCatalogsBySongs";
import { countCatalogSongs } from "@/lib/supabase/catalog_songs/countCatalogSongs";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";

export type ArtistPublicProfile = {
  id: string;
  name: string | null;
  image: string | null;
  socials: Array<{ type: string; username: string | null; profile_url: string }>;
  catalogs: Array<{ id: string; name: string; song_count: number; updated_at: string }>;
};

/**
 * The public subset of an artist's data: name, image, connected socials and
 * linked catalogs. Backs the unauthenticated artist page, so the response is
 * built field-by-field as an allowlist — a database row is never spread into
 * it, and `account_info`'s private fields (instruction, knowledges, label)
 * stay out by construction.
 *
 * An account qualifies as an artist iff it appears as `artist_id` on at least
 * one roster (`account_artist_ids`); personal and workspace accounts return
 * `null`, which the handler turns into the same 404 as an unknown id.
 *
 * Catalogs resolve through the songs graph — `song_artists` (the artist's
 * credited ISRCs) into `catalog_songs` — because `account_catalogs` links a
 * catalog to its owner account, not to the artists whose songs it holds.
 *
 * @param artistId - The artist's account id.
 * @returns The public profile, or null when the id is not an artist.
 */
export async function getArtistPublicProfile(
  artistId: string,
): Promise<ArtistPublicProfile | null> {
  const rows = await getAccountArtistIds({ artistIds: [artistId] });
  const artist = rows?.[0]?.artist_info;
  if (!artist) return null;

  const info = artist.account_info?.[0];
  // Degrade, don't fail: a songs-graph query error costs the catalog list,
  // never the whole unauthenticated page (selectSongArtists throws, chat#1965).
  let songRows: Awaited<ReturnType<typeof selectSongArtists>> = [];
  try {
    songRows = await selectSongArtists({ artists: [artistId] });
  } catch (error) {
    console.error("Error resolving credited songs for public profile:", error);
  }
  const isrcs = [...new Set(songRows.map(row => row.song))];
  const catalogRows = await selectCatalogsBySongs(isrcs);
  const counts = await countCatalogSongs(catalogRows.map(c => c.id));

  const socials = (artist.account_socials ?? [])
    .filter(row => row.social?.profile_url)
    .map(row => ({
      type: getSocialPlatformByLink(row.social?.profile_url ?? ""),
      username: row.social?.username ?? null,
      profile_url: row.social?.profile_url ?? "",
    }));

  const catalogs = catalogRows.map(c => ({
    id: c.id,
    name: c.name,
    song_count: counts[c.id] ?? 0,
    updated_at: c.updated_at,
  }));

  return {
    id: artistId,
    name: artist.name ?? null,
    image: info?.image || null,
    socials,
    catalogs,
  };
}
