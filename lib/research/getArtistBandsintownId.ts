import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";

/**
 * Matches a Bandsintown artist profile URL and captures its numeric id.
 *
 * Case-insensitive because `socials.profile_url` is lowercased by a DB
 * trigger, and tolerant of a missing `www.` and of anything trailing the
 * slug (query strings such as `?came_from=` are common).
 */
const BANDSINTOWN_ARTIST_URL = /bandsintown\.com\/a\/(\d+)-/i;

/**
 * Resolve an artist's Bandsintown numeric id from their connected socials.
 *
 * Callers pass a Recoup `artist_id` rather than a provider id, so this is the
 * one place the provider is looked up. Returns null when the artist has no
 * Bandsintown profile connected — the caller turns that into a 404, which must
 * stay distinct from "connected but not touring" (an empty event list).
 *
 * @param artistId - Recoup artist id (the artist's account id)
 * @returns The numeric Bandsintown artist id, or null when none is connected
 */
export async function getArtistBandsintownId(artistId: string): Promise<string | null> {
  const socials = await selectAccountSocials({ accountId: artistId });

  for (const row of socials) {
    const match = row.social?.profile_url?.match(BANDSINTOWN_ARTIST_URL);
    if (match) return match[1];
  }

  return null;
}
