import generateText from "@/lib/ai/generateText";
import type { ArtistSpotifyData } from "@/lib/artistIntel/getArtistSpotifyData";
import type { ArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import type { ArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";
import type { PeerBenchmark } from "@/lib/artistIntel/getRelatedArtistsData";
import type { ArtistOpportunityScores } from "@/lib/artistIntel/computeArtistOpportunityScores";
import type { CatalogDepth } from "@/lib/artistIntel/analyzeCatalogDepth";

export interface ArtistMarketingCopy {
  // Industry-grade outputs (highest value for artists & labels)
  artist_one_sheet: string;
  ar_memo: string;
  sync_brief: string;
  spotify_playlist_targets: string[];
  brand_partnership_pitch: string;
  // Outreach copy
  playlist_pitch_email: string;
  press_release_opener: string;
  key_talking_points: string[];
  // Social media
  instagram_caption: string;
  tiktok_caption: string;
  twitter_post: string;
}

const SYSTEM_PROMPT =
  "You are a senior music industry executive with 20 years spanning A&R, sync licensing, brand partnerships, and artist management at major labels. " +
  "You write razor-sharp, industry-authentic copy that gets results — not fluff. " +
  "CRITICAL: You are given real Spotify data for comparable artists. You MUST use these actual numbers in your copy — never invent statistics. " +
  "Always respond with valid JSON matching the exact schema requested.";

/**
 * Formats peer benchmarking data into a context string for the AI prompt.
 *
 * @param peerBenchmark - Real Spotify data for related artists.
 * @returns A formatted context string with actual follower counts and percentile rankings.
 */
function buildPeerContext(peerBenchmark: PeerBenchmark | null): string {
  if (!peerBenchmark || peerBenchmark.peers.length === 0) return "No peer data available.";

  const rows = peerBenchmark.peers
    .map(
      p =>
        `  - ${p.name}: ${p.followers.toLocaleString()} followers, ${p.popularity}/100 popularity`,
    )
    .join("\n");

  return `Real Spotify peer data (DO NOT invent different numbers):
${rows}

Peer benchmarks:
- Artist is at the ${peerBenchmark.follower_percentile}th percentile for followers among their peer set
- Artist is at the ${peerBenchmark.popularity_percentile}th percentile for popularity among their peer set
- Peer median followers: ${peerBenchmark.median_followers.toLocaleString()}
- Peer median popularity: ${peerBenchmark.median_popularity}/100
${peerBenchmark.top_peer ? `- Top peer ceiling: ${peerBenchmark.top_peer.name} with ${peerBenchmark.top_peer.followers.toLocaleString()} followers` : ""}`;
}

/**
 * Formats algorithmically computed opportunity scores into a context string for the AI prompt.
 *
 * @param scores - Computed opportunity scores for sync, playlist, A&R, and brand.
 * @returns A formatted context string with scores and rationale.
 */
function buildOpportunityContext(scores: ArtistOpportunityScores | null): string {
  if (!scores) return "";
  return `Algorithmically computed opportunity scores (from real audio + audience data):
- Sync Score: ${scores.sync.score}/100 (${scores.sync.rating}) — ${scores.sync.rationale}
- Playlist Score: ${scores.playlist.score}/100 (${scores.playlist.rating}) — ${scores.playlist.rationale}
- A&R Score: ${scores.ar.score}/100 (${scores.ar.rating}) — ${scores.ar.rationale}
- Brand Score: ${scores.brand.score}/100 (${scores.brand.rating}) — ${scores.brand.rationale}
- Overall Score: ${scores.overall}/100`;
}

/**
 * Formats catalog depth metrics into a context string for the AI prompt.
 *
 * @param catalogDepth - Catalog consistency and hit-concentration metrics.
 * @returns A formatted context string with catalog analysis data.
 */
function buildCatalogContext(catalogDepth: CatalogDepth | null): string {
  if (!catalogDepth) return "";
  return `Catalog depth analysis (from actual Spotify track data):
- ${catalogDepth.track_count} tracks analysed
- Average track popularity: ${catalogDepth.avg_popularity}/100
- Catalog type: ${catalogDepth.catalog_type_label}
- Consistency score: ${catalogDepth.consistency_score}/100
- Top track concentration: ${catalogDepth.top_track_concentration_pct}% of total popularity
- Top 3 tracks: ${catalogDepth.ranked_tracks
    .slice(0, 3)
    .map(t => `"${t.name}" (${t.popularity})`)
    .join(", ")}`;
}

/**
 * Uses AI to synthesize Spotify metadata, MusicFlamingo analysis, web research,
 * real peer benchmarks, and algorithmic opportunity scores into industry-grade
 * marketing and business development materials.
 *
 * Key improvement: All "comparable artist" references are grounded in real Spotify data
 * fetched from the Spotify related-artists API — not hallucinated by the AI.
 *
 * @param spotifyData - Artist Spotify metadata and top tracks.
 * @param musicAnalysis - MusicFlamingo AI audio analysis results.
 * @param webContext - Recent web research about the artist.
 * @param peerBenchmark - Real Spotify data for related artists (follower counts, popularity).
 * @param opportunityScores - Algorithmically computed opportunity scores.
 * @param catalogDepth - Catalog consistency metrics from top track analysis.
 * @returns Ready-to-use industry copy grounded in real data.
 */
export async function buildArtistMarketingCopy(
  spotifyData: ArtistSpotifyData,
  musicAnalysis: ArtistMusicAnalysis | null,
  webContext: ArtistWebContext | null,
  peerBenchmark: PeerBenchmark | null,
  opportunityScores: ArtistOpportunityScores | null,
  catalogDepth: CatalogDepth | null,
): Promise<ArtistMarketingCopy> {
  const { artist, topTracks } = spotifyData;
  const topTrack = topTracks[0];

  const prompt = `Generate industry-grade materials for ${artist.name}.

SPOTIFY STATS (real data — use these exact numbers):
- Followers: ${artist.followers.total.toLocaleString()}
- Popularity Score: ${artist.popularity}/100
- Genres: ${artist.genres.slice(0, 3).join(", ") || "not specified"}
- Top Track: "${topTrack?.name || "unknown"}" from "${topTrack?.album?.name || "unknown"}"

AI MUSIC ANALYSIS (NVIDIA MusicFlamingo audio scan):
${musicAnalysis ? JSON.stringify(musicAnalysis, null, 2) : "Not available"}

RECENT WEB CONTEXT:
${webContext?.summary || "Not available"}

${buildPeerContext(peerBenchmark)}

${buildOpportunityContext(opportunityScores)}

${buildCatalogContext(catalogDepth)}

INSTRUCTIONS:
- Use the real peer follower/popularity numbers above when making comparisons — never invent statistics
- Tailor the A&R memo to reflect the actual opportunity scores and peer gap
- For sync: use the sync score rationale to identify specific placement contexts
- For brand partnerships: use the actual audience lifestyle tags and demographics from the music analysis
- Reference catalog type ("${catalogDepth?.catalog_type_label || "unknown"}") in A&R recommendation

Generate a JSON response with these EXACT fields:

{
  "artist_one_sheet": "A polished 200-word artist one-sheet in the industry standard format. Include: artist name and tagline, 2-3 sentence bio with career highlights, genre/sound description, key stats (real followers and popularity score), top track and album, 3 press/pitch quotes or talking points, and a 'For Booking & Licensing' closing line. Reference at least one real peer artist for positioning context. Professional but energetic tone.",

  "ar_memo": "A 150-word A&R discovery memo for an internal label meeting. Use the REAL peer data: cite actual follower counts from the peer set, state the artist's percentile ranking among peers, and identify the specific gap to the top peer. Reference the A&R opportunity score and what's driving it. Include: artist name, genre/positioning, real comparable artists with their actual stats, current momentum indicators, commercial potential based on catalog type, recommended next steps. Be direct and analytical.",

  "sync_brief": "A 150-word sync licensing brief for music supervisors. Use the sync score (${opportunityScores?.sync.score ?? "N/A"}/100) to explain why this artist is or isn't sync-ready. Include: artist/track name, mood and sonic description derived from the MusicFlamingo analysis, 3-5 specific sync use cases (e.g. 'Opening montage of a Netflix coming-of-age drama'), tempo/BPM from audio analysis if available, comparable synced tracks. Make supervisors visualize the placement immediately.",

  "spotify_playlist_targets": ["8-10 specific named Spotify editorial playlists this artist should pitch to, based on genre, energy level, danceability, and mood from the MusicFlamingo data. Use real playlist names like 'New Music Friday', 'Pollen', 'Hot Country', 'Beast Mode', 'Peaceful Piano', 'Lorem', 'mint', 'Alternative Hip-Hop', etc. Each entry should be just the playlist name."],

  "brand_partnership_pitch": "A 150-word brand partnership pitch for 3-4 specific brands. Base brand alignment on the actual audience lifestyle tags and demographics from the MusicFlamingo audience_profile. For each brand: name the brand, explain the alignment using real demographic data, suggest a specific activation type. Do not invent demographics — only use what's in the audience data.",

  "playlist_pitch_email": "A compelling 150-word pitch email to an independent Spotify playlist curator. Include real stats (followers, popularity), genre, track name, why it fits their playlists, and a clear ask. Professional but passionate tone.",

  "press_release_opener": "A compelling 3-sentence press release opening paragraph. Reference real momentum metrics (follower count, popularity score). Professional journalism style.",

  "key_talking_points": ["5 punchy bullet points that make this artist unique — for press, playlist, sync, and A&R pitches. At least 2 points must reference real data (peer percentile, opportunity scores, catalog type, or actual follower milestones). Each point should be one crisp sentence."],

  "instagram_caption": "An engaging Instagram caption (under 150 chars) with 5 relevant hashtags. Genre-authentic voice.",

  "tiktok_caption": "A TikTok caption (under 100 chars) with 3 trending hashtags.",

  "twitter_post": "A tweet (under 280 chars) for a new release announcement with 2 hashtags."
}

Respond ONLY with the JSON object. No markdown, no extra text.`;

  try {
    const result = await generateText({ system: SYSTEM_PROMPT, prompt });
    const parsed = JSON.parse(result.text) as ArtistMarketingCopy;
    return parsed;
  } catch (error) {
    console.error("Failed to generate marketing copy:", error);
    const genre = artist.genres[0]?.replace(/\s+/g, "") || "music";
    const genreLabel = artist.genres[0] || "emerging";
    const peerLine = peerBenchmark?.top_peer
      ? ` Comparable to ${peerBenchmark.top_peer.name} (${peerBenchmark.top_peer.followers.toLocaleString()} followers).`
      : "";
    return {
      artist_one_sheet: `${artist.name}\n\n${artist.name} is a ${genreLabel} artist with ${artist.followers.total.toLocaleString()} Spotify followers and a ${artist.popularity}/100 popularity score.${peerLine} Their track "${topTrack?.name || "latest release"}" showcases a signature sound that resonates with a growing global audience.\n\nFor Booking & Licensing: agent@recoupable.com`,
      ar_memo: `ARTIST: ${artist.name}\nGENRE: ${genreLabel}\nSTATS: ${artist.followers.total.toLocaleString()} Spotify followers, ${artist.popularity}/100 popularity${peerBenchmark ? ` (${peerBenchmark.follower_percentile}th percentile among peers)` : ""}\nTOP TRACK: "${topTrack?.name || "unknown"}"\n\nMOMENTUM: Growing audience in the ${genreLabel} space.${peerBenchmark?.top_peer ? ` Gap to top peer ${peerBenchmark.top_peer.name}: ${((peerBenchmark.top_peer.followers - artist.followers.total) / 1000).toFixed(0)}K followers.` : ""}\n\nRECOMMENDATION: Monitor for 90 days. Consider development conversation.`,
      sync_brief: `ARTIST: ${artist.name}\nGENRE: ${genreLabel}\nTRACK: "${topTrack?.name || "latest release"}"\nSYNC SCORE: ${opportunityScores?.sync.score ?? "N/A"}/100\n\nSync use cases:\n- Background score for lifestyle/documentary content\n- Retail or app advertising with ${genreLabel} aesthetic\n- Social media brand campaigns\n\nContact: agent@recoupable.com`,
      spotify_playlist_targets: ["New Music Friday", "Lorem", "Fresh Finds", "Radar", "Pollen"],
      brand_partnership_pitch: `${artist.name}'s ${genreLabel} sound and ${artist.followers.total.toLocaleString()}-follower audience opens strong brand alignment opportunities. Brand score: ${opportunityScores?.brand.score ?? "N/A"}/100.`,
      playlist_pitch_email: `Dear Curator,\n\nI'd like to introduce you to ${artist.name}, a ${genreLabel} artist with ${artist.followers.total.toLocaleString()} Spotify followers and a ${artist.popularity}/100 popularity score. Their track "${topTrack?.name || "latest release"}" would be a perfect fit for your playlist.\n\nBest,\nThe Team`,
      press_release_opener: `${artist.name} releases their highly anticipated new work, building momentum with ${artist.followers.total.toLocaleString()} Spotify followers and a ${artist.popularity}/100 popularity score. The new release demonstrates ${catalogDepth ? `their ${catalogDepth.catalog_type_label.toLowerCase()} approach to catalog-building` : "their growing global audience"}.`,
      key_talking_points: [
        `${artist.followers.total.toLocaleString()} Spotify followers with ${artist.popularity}/100 popularity score`,
        peerBenchmark
          ? `Ranked at the ${peerBenchmark.follower_percentile}th percentile among their peer set on Spotify`
          : `${artist.popularity}/100 Spotify popularity — strong algorithmic traction`,
        `Genre: ${artist.genres.slice(0, 2).join(", ") || "emerging"} — growing market segment`,
        catalogDepth
          ? `${catalogDepth.catalog_type_label} — ${catalogDepth.track_count} tracks averaging ${catalogDepth.avg_popularity}/100 popularity`
          : `Top track "${topTrack?.name || "latest release"}" demonstrates commercial appeal`,
        `Overall opportunity score: ${opportunityScores?.overall ?? "N/A"}/100 across sync, playlist, A&R, and brand`,
      ],
      instagram_caption: `New music from ${artist.name} is here 🎵 #newmusic #${genre} #streaming`,
      tiktok_caption: `You need to hear ${artist.name} 🔥 #newmusic #viral #${genre}`,
      twitter_post: `New music alert: ${artist.name} just dropped something special 🎵 #newmusic #${genre}`,
    };
  }
}
