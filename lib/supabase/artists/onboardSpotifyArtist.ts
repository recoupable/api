import { ArtistOnboardingError } from "@/lib/artists/ArtistOnboardingError";
import supabase from "@/lib/supabase/serverClient";

/** Atomically resolves exact Spotify identity and attaches the requested rosters. */
export async function onboardSpotifyArtist(params: {
  accountId: string;
  organizationId?: string;
  name: string;
  spotifyArtistId: string;
}): Promise<{ artist_id: string; created: boolean }> {
  const { data, error } = await supabase
    .rpc("onboard_spotify_artist", {
      p_account_id: params.accountId,
      p_organization_id: params.organizationId ?? null,
      p_name: params.name,
      p_spotify_artist_id: params.spotifyArtistId,
    })
    .single();
  if (error || !data) {
    // Do not fall back to non-atomic creation when the migration is unavailable.
    throw new ArtistOnboardingError(
      error?.code === "42501"
        ? "Access denied to specified organization_id"
        : error?.code === "21000"
          ? "Spotify artist identity is ambiguous. Please contact support."
          : "Could not add artist to the roster. Please retry.",
      error?.code === "42501" ? 403 : error?.code === "21000" ? 409 : 503,
    );
  }
  return data;
}
