import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getSearch from "@/lib/spotify/getSearch";
import { getArtistTopTracks } from "@/lib/spotify/getArtistTopTracks";

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  followers: { total: number };
  popularity: number;
  images: Array<{ url: string; height: number; width: number }>;
}

interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
  popularity: number;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
}

export interface ArtistSpotifyData {
  artist: SpotifyArtist;
  topTracks: SpotifyTrack[];
  previewUrl: string | null;
}

/**
 * Fetches Spotify artist data and top tracks, including 30-second preview URLs.
 *
 * @param artistName - The artist name to search for.
 * @returns Artist data with top tracks and a preview URL, or null if not found.
 */
export async function getArtistSpotifyData(artistName: string): Promise<ArtistSpotifyData | null> {
  const tokenResult = await generateAccessToken();
  if (tokenResult.error || !tokenResult.access_token) {
    console.error("Failed to get Spotify token:", tokenResult.error);
    return null;
  }

  const accessToken = tokenResult.access_token;

  const searchResult = await getSearch({ q: artistName, type: "artist", limit: 1, accessToken });
  if (searchResult.error || !searchResult.data) {
    console.error("Spotify artist search failed:", searchResult.error);
    return null;
  }

  const searchData = searchResult.data as { artists?: { items: SpotifyArtist[] } };
  const artist = searchData.artists?.items?.[0];
  if (!artist) {
    return null;
  }

  const topTracksResult = await getArtistTopTracks({ id: artist.id, market: "US", accessToken });
  if (topTracksResult.error || !topTracksResult.data) {
    console.error("Failed to get top tracks:", topTracksResult.error);
    return { artist, topTracks: [], previewUrl: null };
  }

  const tracksData = topTracksResult.data as { tracks: SpotifyTrack[] };
  const topTracks = tracksData.tracks || [];
  const previewUrl = topTracks.find(t => t.preview_url)?.preview_url ?? null;

  return { artist, topTracks, previewUrl };
}
