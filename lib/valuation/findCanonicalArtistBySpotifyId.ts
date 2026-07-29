import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { selectAccountArtistIds } from "@/lib/supabase/account_artist_ids/selectAccountArtistIds";

/**
 * The canonical artist account for a Spotify artist id, if one already exists.
 *
 * Artists are canonical and shared — `account_artist_ids` is the join that lets
 * many accounts roster the same artist (chat#1866). The lookup is global, but
 * **an artist the requesting account already rosters wins**: the chat add flow
 * creates its own artist row (+ Spotify social) before the fire-and-forget
 * valuation runs, so resolving a different canonical here would link a second
 * roster entry — the exact double this exists to prevent (chat#1889 row 8,
 * reproduced live on chat#1900 after api#791).
 *
 * Best-effort: never throws. Failing this lookup falls back to creating an
 * artist, which is strictly better than failing the valuation.
 *
 * @param spotifyArtistId - The Spotify artist id to resolve.
 * @param accountId - The requesting account; used only to prefer an
 *   already-rostered artist, never to scope the search.
 * @returns The artist's account id, or null when none exists yet.
 */
export async function findCanonicalArtistBySpotifyId(
  spotifyArtistId: string,
  accountId?: string,
): Promise<string | null> {
  try {
    const socials = (await selectSocials({ profileUrlContains: spotifyArtistId })) ?? [];
    if (socials.length === 0) return null;

    const linkedArtistIds: string[] = [];
    for (const social of socials) {
      const links = await selectAccountSocials({ socialId: social.id });
      for (const link of links) {
        if (link.account_id && !linkedArtistIds.includes(link.account_id)) {
          linkedArtistIds.push(link.account_id);
        }
      }
    }
    if (linkedArtistIds.length === 0) return null;

    if (accountId) {
      const rostered = await selectAccountArtistIds([accountId]);
      const rosteredIds = new Set(rostered.map(row => row.artist_id));
      const alreadyRostered = linkedArtistIds.find(id => rosteredIds.has(id));
      if (alreadyRostered) return alreadyRostered;
    }

    return linkedArtistIds[0];
  } catch (error) {
    console.error("Error resolving canonical artist by spotify id:", error);
    return null;
  }
}
