import { getSpotifyFollowers } from "@/lib/spotify/getSpotifyFollowers";

/**
 * Fetches the expected Spotify follower count string for a given artist.
 * Used as ground-truth data when evaluating whether the AI correctly reports follower numbers.
 *
 * @param artist - The artist name to look up on Spotify
 * @returns An object with followerCount and the formatted expected string;
 *   falls back to a zero-count message if the data cannot be retrieved.
 */
async function getSpotifyFollowersExpected(artist: string) {
  try {
    const followerCount = await getSpotifyFollowers(artist);
    const expected = `${artist} has ${followerCount} followers on Spotify.`;

    const data = { followerCount, expected };
    return data;
  } catch (error) {
    console.error(`Error fetching Spotify followers for "${artist}":`, error);
    const fallbackExpected = `${artist} has follower data that could not be retrieved at this time. Please try again later.`;
    const data = { followerCount: 0, expected: fallbackExpected };
    return data;
  }
}

export default getSpotifyFollowersExpected;
