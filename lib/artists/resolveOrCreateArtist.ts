import { ArtistOnboardingError } from "./ArtistOnboardingError";
import { createArtistInDb, type CreateArtistResult } from "@/lib/artists/createArtistInDb";
import { onboardSpotifyArtist } from "@/lib/supabase/artists/onboardSpotifyArtist";
import { selectAccountWithSocials } from "@/lib/supabase/accounts/selectAccountWithSocials";

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

/** Resolves Spotify onboarding in one transaction; name-only creation retains its existing path. */
export async function resolveOrCreateArtist(
  params: ResolveOrCreateArtistParams,
): Promise<ResolveOrCreateArtistResult> {
  const { name, accountId, organizationId, spotifyArtistId } = params;
  if (spotifyArtistId) {
    const result = await onboardSpotifyArtist({ name, accountId, organizationId, spotifyArtistId });
    const artist = await selectAccountWithSocials(result.artist_id);
    if (!artist)
      throw new ArtistOnboardingError(
        "Artist was added, but its profile could not be loaded. Please retry.",
        503,
        result.artist_id,
      );
    return { artist: { ...artist, account_id: artist.id }, created: result.created };
  }
  return { artist: await createArtistInDb(name, accountId, organizationId), created: true };
}
