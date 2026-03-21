import generateAccessToken from "@/lib/spotify/generateAccessToken";
import { getRelatedArtists } from "@/lib/spotify/getRelatedArtists";

export interface PeerArtist {
  name: string;
  spotify_id: string;
  followers: number;
  popularity: number;
  genres: string[];
}

export interface PeerBenchmark {
  peers: PeerArtist[];
  /** Percentile rank of the target artist among their peers (0–100) */
  follower_percentile: number;
  popularity_percentile: number;
  median_followers: number;
  median_popularity: number;
  /** Peer with highest followers — the "ceiling" to aim for */
  top_peer: PeerArtist | null;
}

/**
 * Fetches Spotify related artists and computes peer benchmarking data.
 * Returns real follower counts and popularity scores for the top 5 peers
 * so AI copy can cite actual numbers instead of hallucinated comparisons.
 *
 * @param artistId - The target artist's Spotify ID.
 * @param targetFollowers - The target artist's follower count, for percentile ranking.
 * @param targetPopularity - The target artist's popularity score, for percentile ranking.
 * @returns Peer benchmarking data, or null on failure.
 */
export async function getRelatedArtistsData(
  artistId: string,
  targetFollowers: number,
  targetPopularity: number,
): Promise<PeerBenchmark | null> {
  const tokenResult = await generateAccessToken();
  if (tokenResult.error || !tokenResult.access_token) return null;

  const related = await getRelatedArtists(artistId, tokenResult.access_token);
  if (!related || related.length === 0) return null;

  // Take top 5 most-followed peers for a focused comparison
  const peers: PeerArtist[] = related
    .slice(0, 10)
    .sort((a, b) => b.followers.total - a.followers.total)
    .slice(0, 5)
    .map(a => ({
      name: a.name,
      spotify_id: a.id,
      followers: a.followers.total,
      popularity: a.popularity,
      genres: a.genres.slice(0, 3),
    }));

  const followerCounts = peers.map(p => p.followers).sort((a, b) => a - b);
  const popularityCounts = peers.map(p => p.popularity).sort((a, b) => a - b);

  const median = (arr: number[]) => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
  };

  const percentile = (arr: number[], value: number) => {
    const below = arr.filter(v => v < value).length;
    return Math.round((below / arr.length) * 100);
  };

  return {
    peers,
    follower_percentile: percentile(followerCounts, targetFollowers),
    popularity_percentile: percentile(popularityCounts, targetPopularity),
    median_followers: median(followerCounts),
    median_popularity: median(popularityCounts),
    top_peer: peers[0] ?? null,
  };
}
