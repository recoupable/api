import { Tables } from "@/types/database.types";
import supabase from "../serverClient";

/**
 * Selects socials whose `profile_url` points at a given Spotify artist id.
 *
 * Matches on the id rather than a full-URL equality check because
 * `profile_url` is stored inconsistently — with and without a scheme
 * (`open.spotify.com/artist/{id}` vs `https://open.spotify.com/artist/{id}`),
 * and sometimes with a `?si=` query — so `selectSocials({ profile_url })`
 * (an exact `eq`) misses real matches.
 *
 * @param spotifyArtistId - The Spotify artist id to look for.
 * @returns The matching socials, newest first.
 * @throws Error if the query fails.
 */
export async function selectSocialsBySpotifyArtistId(
  spotifyArtistId: string,
): Promise<Tables<"socials">[]> {
  const { data, error } = await supabase
    .from("socials")
    .select("*")
    .ilike("profile_url", `%${spotifyArtistId}%`)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch socials by spotify artist id: ${error.message}`);
  }

  return data || [];
}
