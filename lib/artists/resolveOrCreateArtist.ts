import { createArtistInDb, type CreateArtistResult } from "@/lib/artists/createArtistInDb";
import { findCanonicalArtistBySpotifyId } from "@/lib/valuation/findCanonicalArtistBySpotifyId";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";
import { selectAccountWithSocials } from "@/lib/supabase/accounts/selectAccountWithSocials";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";

export interface ResolveOrCreateArtistParams {
  name: string;
  accountId: string;
  organizationId?: string;
  /** When present, resolve-or-create the canonical artist for this Spotify id. */
  spotifyArtistId?: string;
}

export interface ResolveOrCreateArtistResult {
  artist: CreateArtistResult | null;
  /** false when an existing canonical was linked instead of created (→ 200, not 201). */
  created: boolean;
}

/**
 * Creates an artist — or, when `spotifyArtistId` names an artist that already
 * exists, links that canonical to the account instead of minting a duplicate.
 *
 * One canonical artist per Spotify id (chat#1889, decision 2026-07-29):
 * artists are shared across accounts via `account_artist_ids`, so creation is
 * the only place dedup can be enforced. Every add path minting its own row is
 * what made downstream canonical lookups ambiguous and doubled rosters.
 *
 * The social attach on the create path is non-fatal (same contract as the
 * chat-side add, chat#1892): the row exists by then, and a failed attach must
 * not fail the add — the social is still fixable in verify-socials.
 */
export async function resolveOrCreateArtist(
  params: ResolveOrCreateArtistParams,
): Promise<ResolveOrCreateArtistResult> {
  const { name, accountId, organizationId, spotifyArtistId } = params;

  if (spotifyArtistId) {
    const canonicalId = await findCanonicalArtistBySpotifyId(spotifyArtistId);
    if (canonicalId) {
      await insertAccountArtistId(accountId, canonicalId);
      const artist = await selectAccountWithSocials(canonicalId);
      return {
        artist: artist ? { ...artist, account_id: artist.id } : null,
        created: false,
      };
    }
  }

  const created = await createArtistInDb(name, accountId, organizationId);

  if (created && spotifyArtistId) {
    try {
      await updateArtistSocials(created.account_id, {
        SPOTIFY: `https://open.spotify.com/artist/${spotifyArtistId}`,
      });
    } catch {
      // Non-fatal by design — see docstring.
    }
  }

  return { artist: created, created: true };
}
