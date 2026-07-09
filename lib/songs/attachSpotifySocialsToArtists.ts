import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";

const SPOTIFY_ARTIST_PATH = "open.spotify.com/artist/";

/**
 * Forward fix for chat#1850 P1: capture-created canonical artist accounts had
 * zero socials, so they were unfindable by Spotify id. Attaches each artist's
 * Spotify profile URL — case preserved, Spotify ids are case-sensitive base62
 * (a legacy write path lowercased them; do not repeat that) — via the same
 * socials write path PATCH /api/artists uses. Skips artists that already have
 * a Spotify artist social so a manual link is never clobbered.
 *
 * Best-effort per artist: never throws, so capture enrichment is unaffected.
 *
 * @param artists - Resolved artist account ids with their Spotify artist ids
 */
export async function attachSpotifySocialsToArtists(
  artists: { artistAccountId: string; spotifyArtistId: string }[],
): Promise<void> {
  const spotifyIdByAccount = new Map(
    artists.map(({ artistAccountId, spotifyArtistId }) => [artistAccountId, spotifyArtistId]),
  );

  await Promise.all(
    [...spotifyIdByAccount.entries()].map(async ([accountId, spotifyArtistId]) => {
      try {
        const socials = await selectAccountSocials({ accountId, limit: 10000 });
        const hasSpotify = socials.some(accountSocial =>
          (accountSocial.social?.profile_url ?? "").includes(SPOTIFY_ARTIST_PATH),
        );
        if (hasSpotify) return;

        await updateArtistSocials(accountId, {
          SPOTIFY: `https://open.spotify.com/artist/${spotifyArtistId}`,
        });
      } catch (error) {
        console.error("Error attaching Spotify social to artist:", accountId, error);
      }
    }),
  );
}
