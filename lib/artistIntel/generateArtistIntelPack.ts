import type { ArtistMarketingCopy } from "@/lib/artistIntel/buildArtistMarketingCopy";
import type { ArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import type { ArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";
import { buildArtistMarketingCopy } from "@/lib/artistIntel/buildArtistMarketingCopy";
import { getArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import { getArtistSpotifyData } from "@/lib/artistIntel/getArtistSpotifyData";
import { getArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";

export interface ArtistIntelPack {
  artist: {
    name: string;
    spotify_id: string;
    genres: string[];
    followers: number;
    popularity: number;
    image_url: string | null;
  };
  top_track: {
    name: string;
    spotify_id: string;
    preview_url: string | null;
    album_name: string;
    popularity: number;
  } | null;
  music_analysis: ArtistMusicAnalysis | null;
  web_context: ArtistWebContext | null;
  marketing_pack: ArtistMarketingCopy;
  elapsed_seconds: number;
}

export type ArtistIntelPackResult =
  | { type: "success"; pack: ArtistIntelPack }
  | { type: "error"; error: string };

/**
 * Generates a complete Artist Intelligence Pack by orchestrating:
 * 1. Spotify: Artist profile + top tracks (including 30-second preview URLs).
 * 2. MusicFlamingo (NVIDIA 8B): AI audio analysis via Spotify preview URL — genre, BPM,
 *    key, mood, audience profile, and playlist pitch targets.
 * 3. Perplexity: Real-time web research on the artist.
 * 4. AI Synthesis: Actionable marketing copy (pitch email, social captions, press release).
 *
 * Steps 2 and 3 run in parallel to minimize latency.
 *
 * @param artistName - The artist name to analyze.
 * @returns A complete intelligence pack or an error.
 */
export async function generateArtistIntelPack(artistName: string): Promise<ArtistIntelPackResult> {
  const startTime = Date.now();

  const spotifyData = await getArtistSpotifyData(artistName);
  if (!spotifyData) {
    return { type: "error", error: `Artist "${artistName}" not found on Spotify` };
  }

  const [musicAnalysis, webContext] = await Promise.all([
    spotifyData.previewUrl ? getArtistMusicAnalysis(spotifyData.previewUrl) : Promise.resolve(null),
    getArtistWebContext(artistName),
  ]);

  const marketingCopy = await buildArtistMarketingCopy(spotifyData, musicAnalysis, webContext);

  const { artist, topTracks } = spotifyData;
  const topTrack = topTracks[0] ?? null;
  const elapsed_seconds = Math.round(((Date.now() - startTime) / 1000) * 100) / 100;

  const pack: ArtistIntelPack = {
    artist: {
      name: artist.name,
      spotify_id: artist.id,
      genres: artist.genres,
      followers: artist.followers.total,
      popularity: artist.popularity,
      image_url: artist.images?.[0]?.url ?? null,
    },
    top_track: topTrack
      ? {
          name: topTrack.name,
          spotify_id: topTrack.id,
          preview_url: topTrack.preview_url,
          album_name: topTrack.album.name,
          popularity: topTrack.popularity,
        }
      : null,
    music_analysis: musicAnalysis,
    web_context: webContext,
    marketing_pack: marketingCopy,
    elapsed_seconds,
  };

  return { type: "success", pack };
}
