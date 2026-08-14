import type { SpotifyArtist } from "@/types/spotify.types";
import { upsertArtistInfoFields } from "@/lib/artists/upsertArtistInfoFields";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";

/**
 * Enrich a freshly linked searched artist with its real Spotify profile so the
 * roster and verify-socials UI show an avatar + follower count instead of a
 * blank avatar and "0 followers" (chat#1881 P1). Sets the artist's avatar image
 * (account_info) and upserts its Spotify social row with avatar / followerCount
 * / username from the Spotify profile.
 *
 * Best-effort: never throws — enrichment must not fail the claim.
 *
 * @param params.artistId - The linked artist account id
 * @param params.spotifyArtistId - The searched Spotify artist id
 * @param params.spotifyArtist - The resolved Spotify artist profile
 */
export async function enrichSearchedArtistProfile(params: {
  artistId: string;
  spotifyArtistId: string;
  spotifyArtist: SpotifyArtist;
}): Promise<void> {
  const { artistId, spotifyArtistId, spotifyArtist } = params;
  try {
    const avatar = spotifyArtist.images?.[0]?.url;
    if (avatar) {
      await upsertArtistInfoFields({ artistId, image: avatar });
    }
    // Upsert the SAME row updateArtistSocials created/linked. That path stores
    // the social under a normalized profile_url (protocol/www/trailing-slash
    // stripped), so we must normalize here too — otherwise the upsert lands on
    // a separate orphan row (raw vs normalized key) and the account-linked
    // social stays un-enriched (chat#1881 P1 — caught in preview verification).
    await upsertSocials([
      {
        profile_url: normalizeProfileUrl(`https://open.spotify.com/artist/${spotifyArtistId}`),
        username: spotifyArtist.name,
        avatar: avatar ?? null,
        followerCount: spotifyArtist.followers?.total ?? null,
      },
    ]);
  } catch (error) {
    console.error("Error enriching searched artist profile:", error);
  }
}
