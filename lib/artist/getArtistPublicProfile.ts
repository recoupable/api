import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
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
  const catalogRows = await selectAccountCatalogs([artistId]);
  const counts = await countCatalogSongs(catalogRows.map(c => c.id));

  return {
    id: artistId,
    name: artist.name ?? null,
    image: info?.image || null,
    socials: (artist.account_socials ?? [])
      .filter(row => row.social?.profile_url)
      .map(row => ({
        type: getSocialPlatformByLink(row.social?.profile_url ?? ""),
        username: row.social?.username ?? null,
        profile_url: row.social?.profile_url ?? "",
      })),
    catalogs: catalogRows.map(c => ({
      id: c.id,
      name: c.name,
      song_count: counts[c.id] ?? 0,
      updated_at: c.updated_at,
    })),
  };
}
