import { selectSocialsBySpotifyArtistId } from "@/lib/supabase/socials/selectSocialsBySpotifyArtistId";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

/**
 * The canonical artist account for a Spotify artist id, if one already exists.
 *
 * Artists are canonical and shared — `account_artist_ids` is the join that lets
 * many accounts roster the same artist (chat#1866). So this lookup is
 * deliberately **global**, not scoped to the requesting account: scoping it
 * per-account is what lets every signup mint its own copy of the same Spotify
 * artist, which is the duplicate `linkSearchedArtistToAccount` was producing
 * (chat#1889 row 8).
 *
 * Best-effort: never throws. Failing this lookup falls back to creating an
 * artist, which is strictly better than failing the valuation.
 *
 * @param spotifyArtistId - The Spotify artist id to resolve.
 * @returns The artist's account id, or null when none exists yet.
 */
export async function findCanonicalArtistBySpotifyId(
  spotifyArtistId: string,
): Promise<string | null> {
  try {
    const socials = await selectSocialsBySpotifyArtistId(spotifyArtistId);
    if (socials.length === 0) return null;

    for (const social of socials) {
      const links = await selectAccountSocials({ socialId: social.id });
      const linked = links.find(link => link.account_id);
      if (linked?.account_id) return linked.account_id;
    }

    return null;
  } catch (error) {
    console.error("Error resolving canonical artist by spotify id:", error);
    return null;
  }
}
