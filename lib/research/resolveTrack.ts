import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getSearch from "@/lib/spotify/getSearch";
import { handleResearch } from "@/lib/research/handleResearch";
import { extractProviderTrackId } from "@/lib/research/extractProviderTrackId";

/**
 * Resolves a track name (+ optional artist) to a provider track ID.
 *
 * Uses Spotify search for accurate matching, gets the ISRC, then maps
 * to a provider ID via /track/isrc/{isrc}/get-ids.
 * Works across all platforms since ISRC is a universal identifier.
 *
 * Provider calls are routed through {@link handleResearch} so each
 * lookup properly deducts credits from the caller's account.
 */
export async function resolveTrack(
  q: string,
  artist: string | undefined,
  accountId: string,
): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  const searchQuery = artist ? `${q} artist:${artist}` : q;

  const tokenResult = await generateAccessToken();
  if (tokenResult.error || !tokenResult.access_token) {
    return { error: "Failed to authenticate with Spotify" };
  }

  const { data, error } = await getSearch({
    q: searchQuery,
    type: "track",
    limit: 1,
    accessToken: tokenResult.access_token,
  });

  if (error || !data) {
    return { error: "Spotify search failed" };
  }

  interface SpotifyTrackItem {
    id: string;
    name: string;
    external_ids?: { isrc?: string };
  }

  const tracks: SpotifyTrackItem[] = data?.tracks?.items ?? [];
  if (tracks.length === 0) {
    return { error: `No track found matching "${q}"${artist ? ` by ${artist}` : ""}` };
  }

  const spotifyTrack = tracks[0];
  const isrc = spotifyTrack.external_ids?.isrc;

  if (isrc) {
    const result = await handleResearch({
      accountId,
      path: `/track/isrc/${isrc}/get-ids`,
    });
    if ("data" in result) {
      const providerId = extractProviderTrackId(result.data);
      if (providerId) return { id: providerId };
    }
  }

  const spotifyId = spotifyTrack.id;
  const result = await handleResearch({
    accountId,
    path: `/track/spotify/${spotifyId}/get-ids`,
  });
  if ("data" in result) {
    const providerId = extractProviderTrackId(result.data);
    if (providerId) return { id: providerId };
  }

  return { error: `Could not resolve provider track ID for "${spotifyTrack.name}"` };
}
