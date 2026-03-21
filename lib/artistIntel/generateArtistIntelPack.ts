import type { ArtistMarketingCopy } from "@/lib/artistIntel/buildArtistMarketingCopy";
import type { CatalogDepth } from "@/lib/artistIntel/analyzeCatalogDepth";
import type { ArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import type { ArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";
import type { PeerBenchmark } from "@/lib/artistIntel/getRelatedArtistsData";
import type { ArtistOpportunityScores } from "@/lib/artistIntel/computeArtistOpportunityScores";
import { buildArtistMarketingCopy } from "@/lib/artistIntel/buildArtistMarketingCopy";
import { analyzeCatalogDepth } from "@/lib/artistIntel/analyzeCatalogDepth";
import { formatArtistIntelPackAsMarkdown } from "@/lib/artistIntel/formatArtistIntelPackAsMarkdown";
import { getArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import { getArtistSpotifyData } from "@/lib/artistIntel/getArtistSpotifyData";
import { getArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";
import { getRelatedArtistsData } from "@/lib/artistIntel/getRelatedArtistsData";
import { computeArtistOpportunityScores } from "@/lib/artistIntel/computeArtistOpportunityScores";

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
  /** Real Spotify data for related artists — grounds all "comparable artist" references */
  peer_benchmark: PeerBenchmark | null;
  /** Algorithmically computed from MusicFlamingo + Spotify data — no AI inference */
  opportunity_scores: ArtistOpportunityScores;
  /** Catalog consistency analysis across all top tracks */
  catalog_depth: CatalogDepth | null;
  marketing_pack: ArtistMarketingCopy;
  formatted_report: string;
  elapsed_seconds: number;
}

export type ArtistIntelPackResult =
  | { type: "success"; pack: ArtistIntelPack }
  | { type: "error"; error: string };

/**
 * Generates a complete Artist Intelligence Pack by orchestrating:
 * 1. Spotify: Artist profile + top tracks (including 30-second preview URLs).
 * 2. MusicFlamingo (NVIDIA 8B): AI audio analysis — genre, BPM, key, mood, audience profile, playlist pitch.
 * 3. Perplexity: Real-time web research on the artist.
 * 4. Related Artists: Real Spotify data for peer benchmarking (actual follower counts, not hallucinated comps).
 * 5. Opportunity Scores: Algorithmically computed from real data — Sync, Playlist, A&R, Brand (0–100).
 * 6. Catalog Depth: Hit-driven vs. consistent catalog analysis across all top tracks.
 * 7. AI Synthesis: Marketing copy grounded in real competitor data and scores.
 *
 * Steps 2, 3, and 4 run in parallel to minimize latency.
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

  const { artist, topTracks } = spotifyData;

  // All three data-fetch steps run in parallel
  const [musicAnalysis, webContext, peerBenchmark] = await Promise.all([
    spotifyData.previewUrl ? getArtistMusicAnalysis(spotifyData.previewUrl) : Promise.resolve(null),
    getArtistWebContext(artistName),
    getRelatedArtistsData(artist.id, artist.followers.total, artist.popularity),
  ]);

  // Both are synchronous — computed from already-fetched data
  const opportunityScores = computeArtistOpportunityScores(
    musicAnalysis,
    artist.followers.total,
    artist.popularity,
    peerBenchmark,
  );

  const catalogDepth = analyzeCatalogDepth(
    topTracks.map(t => ({ name: t.name, popularity: t.popularity })),
  );

  // AI synthesis is last — it receives all real data to ground its outputs
  const marketingCopy = await buildArtistMarketingCopy(
    spotifyData,
    musicAnalysis,
    webContext,
    peerBenchmark,
    opportunityScores,
    catalogDepth,
  );

  const topTrack = topTracks[0] ?? null;
  const elapsed_seconds = Math.round(((Date.now() - startTime) / 1000) * 100) / 100;

  const packWithoutReport: Omit<ArtistIntelPack, "formatted_report"> = {
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
    peer_benchmark: peerBenchmark,
    opportunity_scores: opportunityScores,
    catalog_depth: catalogDepth,
    marketing_pack: marketingCopy,
    elapsed_seconds,
  };

  const pack: ArtistIntelPack = {
    ...packWithoutReport,
    formatted_report: formatArtistIntelPackAsMarkdown(packWithoutReport as ArtistIntelPack),
  };

  return { type: "success", pack };
}
