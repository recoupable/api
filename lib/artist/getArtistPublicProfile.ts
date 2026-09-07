import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { getArtistProfileSongs } from "./getArtistProfileSongs";
import { getArtistProfileCatalogs } from "./getArtistProfileCatalogs";
import type { ProfileSong } from "./buildProfileSongs";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";
import { computeValuationBand, type ValuationBand } from "@/lib/catalog/computeValuationBand";

export type ArtistPublicProfile = {
  id: string;
  name: string | null;
  image: string | null;
  socials: Array<{ type: string; username: string | null; profile_url: string }>;
  songs: ProfileSong[];
  song_count: number;
  catalogs: Array<{
    id: string;
    name: string;
    song_count: number;
    updated_at: string;
    songs: ProfileSong[];
  }>;
  valuation: ValuationBand | null;
};

/**
 * Public allowlist for the unauthenticated artist profile. Artist credits are
 * the song source of truth; saved catalogs only enrich legacy metadata.
 * Accounts not on a roster as an artist return null (the route responds 404).
 */
export async function getArtistPublicProfile(
  artistId: string,
): Promise<ArtistPublicProfile | null> {
  const rows = await getAccountArtistIds({ artistIds: [artistId] });
  const artist = rows?.[0]?.artist_info;
  if (!artist) return null;

  const info = artist.account_info?.[0];
  let songs: ProfileSong[] = [];
  try {
    songs = await getArtistProfileSongs(artistId);
  } catch (error) {
    console.error("Error resolving credited songs for public profile:", error);
  }

  const totalStreams = songs.reduce((total, song) => total + song.plays, 0);
  let valuation =
    totalStreams > 0
      ? computeValuationBand({ totalStreams, earliestReleaseDate: null }).valuation
      : null;
  let catalogs: ArtistPublicProfile["catalogs"] = [];
  try {
    const enrichment = await getArtistProfileCatalogs(songs);
    catalogs = enrichment.catalogs;
    valuation = enrichment.valuation;
  } catch (error) {
    console.error("Error enriching public profile catalogs:", error);
  }

  const socials = (artist.account_socials ?? [])
    .filter(row => row.social?.profile_url)
    .map(row => ({
      type: getSocialPlatformByLink(row.social?.profile_url ?? ""),
      username: row.social?.username ?? null,
      profile_url: row.social?.profile_url ?? "",
    }));

  return {
    id: artistId,
    name: artist.name ?? null,
    image: info?.image || null,
    socials,
    songs,
    song_count: songs.length,
    catalogs,
    valuation,
  };
}
