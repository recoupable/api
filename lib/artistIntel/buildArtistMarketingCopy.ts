import generateText from "@/lib/ai/generateText";
import type { ArtistSpotifyData } from "@/lib/artistIntel/getArtistSpotifyData";
import type { ArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import type { ArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";

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
  "Always respond with valid JSON matching the exact schema requested.";

/**
 * Uses AI to synthesize Spotify metadata, MusicFlamingo analysis, and web research
 * into industry-grade marketing and business development materials for artists and labels.
 *
 * @param spotifyData - Artist Spotify metadata and top tracks.
 * @param musicAnalysis - MusicFlamingo AI audio analysis results.
 * @param webContext - Recent web research about the artist.
 * @returns Ready-to-use industry copy (one-sheet, A&R memo, sync brief, playlist targets, brand pitch, social).
 */
export async function buildArtistMarketingCopy(
  spotifyData: ArtistSpotifyData,
  musicAnalysis: ArtistMusicAnalysis | null,
  webContext: ArtistWebContext | null,
): Promise<ArtistMarketingCopy> {
  const { artist, topTracks } = spotifyData;
  const topTrack = topTracks[0];

  const prompt = `Generate industry-grade materials for ${artist.name}.

Spotify Stats:
- Followers: ${artist.followers.total.toLocaleString()}
- Popularity Score: ${artist.popularity}/100
- Genres: ${artist.genres.slice(0, 3).join(", ") || "not specified"}
- Top Track: "${topTrack?.name || "unknown"}" from "${topTrack?.album?.name || "unknown"}"

AI Music Analysis (NVIDIA MusicFlamingo audio scan):
${musicAnalysis ? JSON.stringify(musicAnalysis, null, 2) : "Not available"}

Recent Web Context:
${webContext?.summary || "Not available"}

Generate a JSON response with these EXACT fields:

{
  "artist_one_sheet": "A polished 200-word artist one-sheet in the industry standard format. Include: artist name and tagline, 2-3 sentence bio with career highlights, genre/sound description, key stats (followers, popularity), top track and album, 3 press/pitch quotes or talking points, and a 'For Booking & Licensing' closing line. Professional but energetic tone.",

  "ar_memo": "A 150-word A&R discovery memo written as if for an internal label meeting. Include: artist name, genre/positioning, 2-3 comparable artists with market context (e.g. 'sounds like X but with Y's audience'), current momentum indicators (Spotify stats, recent press), commercial potential, recommended next steps (signing, development deal, joint venture). Be direct and analytical — this is for executives.",

  "sync_brief": "A 150-word sync licensing brief for music supervisors. Include: artist/track name, mood and sonic description, 3-5 specific sync use cases (e.g. 'Opening montage of a Netflix coming-of-age drama', 'Luxury car commercial targeting 30-45 year olds', 'Yoga app background loop'), tempo/BPM if known, comparable synced tracks. Make supervisors visualize the placement immediately.",

  "spotify_playlist_targets": ["8-10 specific named Spotify editorial playlists this artist should pitch to, based on genre and mood. Use real playlist names like 'New Music Friday', 'Pollen', 'Hot Country', 'Beast Mode', 'Peaceful Piano', 'Lorem', 'mint', 'Alternative Hip-Hop', etc. Each entry should be just the playlist name, nothing else."],

  "brand_partnership_pitch": "A 150-word brand partnership pitch covering 3-4 specific brand categories that align with this artist's sound, audience, and aesthetic (e.g. 'Nike — high-energy BPM and youth demographic aligns with their Run Club campaign', 'Glossier — bedroom pop aesthetic matches their indie-cool beauty positioning'). For each brand, name the brand, explain the alignment, and suggest a specific activation type (concert series, campaign soundtrack, social collab).",

  "playlist_pitch_email": "A compelling 150-word pitch email to an independent Spotify playlist curator. Include artist name, genre, track name, follower count, why it fits their playlists, and a clear ask. Professional but passionate tone.",

  "press_release_opener": "A compelling 3-sentence press release opening paragraph. Professional journalism style.",

  "key_talking_points": ["5 punchy bullet points that make this artist unique — for press, playlist, sync, and A&R pitches. Each point should be one crisp sentence."],

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
    return {
      artist_one_sheet: `${artist.name}\n\n${artist.name} is a ${genreLabel} artist with ${artist.followers.total.toLocaleString()} Spotify followers and a ${artist.popularity}/100 popularity score. Their track "${topTrack?.name || "latest release"}" showcases a signature sound that resonates with a growing global audience.\n\nKey Stats: ${artist.followers.total.toLocaleString()} Spotify followers · ${artist.popularity}/100 popularity · ${artist.genres.slice(0, 2).join(", ") || "emerging"}\n\nFor Booking & Licensing: agent@recoupable.com`,
      ar_memo: `ARTIST: ${artist.name}\nGENRE: ${genreLabel}\nSTATS: ${artist.followers.total.toLocaleString()} Spotify followers, ${artist.popularity}/100 popularity\nTOP TRACK: "${topTrack?.name || "unknown"}"\n\nMOMENTUM: Growing audience in the ${genreLabel} space with consistent engagement metrics. The ${artist.popularity}/100 popularity score indicates strong algorithmic traction.\n\nRECOMMENDATION: Monitor for 90 days. Consider development conversation.`,
      sync_brief: `ARTIST: ${artist.name}\nGENRE: ${genreLabel}\nTRACK: "${topTrack?.name || "latest release"}"\n\nSync use cases:\n- Background score for lifestyle/documentary content\n- Retail or app advertising with ${genreLabel} aesthetic\n- Social media brand campaigns targeting youth audiences\n\nContact: agent@recoupable.com`,
      spotify_playlist_targets: ["New Music Friday", "Lorem", "Fresh Finds", "Radar", "Pollen"],
      brand_partnership_pitch: `${artist.name}'s ${genreLabel} sound and ${artist.followers.total.toLocaleString()}-follower audience opens strong brand alignment opportunities. Youth lifestyle brands (apparel, footwear, streaming platforms) match their demographic. Consider activations around new release cycles for maximum cultural relevance.`,
      playlist_pitch_email: `Dear Curator,\n\nI'd like to introduce you to ${artist.name}, a ${genreLabel} artist with ${artist.followers.total.toLocaleString()} Spotify followers and a ${artist.popularity}/100 popularity score. Their track "${topTrack?.name || "latest release"}" would be a perfect fit for your playlist.\n\nBest,\nThe Team`,
      press_release_opener: `${artist.name} releases their highly anticipated new work, continuing to build momentum in the ${genreLabel} space. With ${artist.followers.total.toLocaleString()} Spotify followers and a growing global audience, the artist delivers another standout offering. The new release showcases their signature sound and artistic evolution.`,
      key_talking_points: [
        `${artist.followers.total.toLocaleString()} Spotify followers with strong engagement`,
        `${artist.popularity}/100 Spotify popularity score — top-tier algorithmic traction`,
        `Genre: ${artist.genres.slice(0, 2).join(", ") || "emerging"} — growing market segment`,
        `Top track "${topTrack?.name || "latest release"}" demonstrates commercial appeal`,
        `Positioned for playlist and sync opportunities across multiple formats`,
      ],
      instagram_caption: `New music from ${artist.name} is here 🎵 #newmusic #${genre} #streaming`,
      tiktok_caption: `You need to hear ${artist.name} 🔥 #newmusic #viral #${genre}`,
      twitter_post: `New music alert: ${artist.name} just dropped something special 🎵 #newmusic #${genre}`,
    };
  }
}
