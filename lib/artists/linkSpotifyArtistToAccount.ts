import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectAccountIdsBySocialId } from "@/lib/supabase/account_socials/selectAccountIdsBySocialId";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";
import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { normalizeProfileUrl } from "@/lib/socials/normalizeProfileUrl";

export type LinkSpotifyArtistParams = {
  /** The Spotify artist id to resolve-or-create. */
  spotifyId: string;
  /** The owner account the artist is linked to (derived from auth). */
  accountId: string;
  /** Display name used only when a new artist account is created. */
  name?: string;
  /** Optional organization to link a newly created artist to. */
  organizationId?: string;
};

export type LinkSpotifyArtistResult = {
  /** The resolved or newly created artist account id. */
  artistId: string;
  /** Whether a new artist account was created. */
  created: boolean;
  /** Whether a new account_artist_ids link was created. */
  linked: boolean;
};

/**
 * Resolve-or-create the artist account for a Spotify artist and link it to an
 * owner account's roster. Idempotent on both axes: an existing artist account
 * behind the Spotify profile is reused, and an already-present roster link is a
 * no-op.
 *
 * Resolution: the canonical Spotify profile URL maps to a `socials` row; the
 * `account_socials` rows for that social point at the artist account. When none
 * exists, a fresh artist account is created (which links it to the owner via
 * `createArtistInDb`) and the Spotify social is attached.
 *
 * @param params - Spotify id, owner account id, and optional name/organization.
 * @returns The artist id plus whether it was created and/or newly linked.
 * @throws Error if artist creation fails.
 */
export async function linkSpotifyArtistToAccount(
  params: LinkSpotifyArtistParams,
): Promise<LinkSpotifyArtistResult> {
  const { spotifyId, accountId, name, organizationId } = params;

  const canonicalUrl = `https://open.spotify.com/artist/${spotifyId}`;
  const normalizedUrl = normalizeProfileUrl(canonicalUrl);

  const socials = await selectSocials({ profile_url: normalizedUrl });
  const social = socials && socials.length > 0 ? socials[0] : null;

  // Resolve the existing artist account behind the Spotify profile, if any.
  const existingArtistId = social ? (await selectAccountIdsBySocialId(social.id))[0] : undefined;

  if (existingArtistId) {
    // createArtistInDb is skipped — only ensure the roster link (idempotent).
    const existingLinks = await getAccountArtistIds({ accountIds: [accountId] });
    const alreadyLinked = existingLinks.some(link => link.artist_id === existingArtistId);

    if (alreadyLinked) {
      return { artistId: existingArtistId, created: false, linked: false };
    }

    await insertAccountArtistId(accountId, existingArtistId);
    return { artistId: existingArtistId, created: false, linked: true };
  }

  // No artist account exists for this Spotify profile — create one. This also
  // creates the account_artist_ids link to the owner, so we don't link again.
  const artist = await createArtistInDb(name || spotifyId, accountId, organizationId);
  if (!artist) {
    throw new Error("Failed to create artist");
  }

  await updateArtistSocials(artist.account_id, { SPOTIFY: canonicalUrl });

  return { artistId: artist.account_id, created: true, linked: true };
}
