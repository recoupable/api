import generateText from "@/lib/ai/generateText";
import type { ArtistSpotifyData } from "@/lib/artistIntel/getArtistSpotifyData";
import type { ArtistMusicAnalysis } from "@/lib/artistIntel/getArtistMusicAnalysis";
import type { ArtistWebContext } from "@/lib/artistIntel/getArtistWebContext";

export interface ArtistMarketingCopy {
  playlist_pitch_email: string;
  instagram_caption: string;
  tiktok_caption: string;
  twitter_post: string;
  press_release_opener: string;
  key_talking_points: string[];
}

const SYSTEM_PROMPT =
  "You are an elite music marketing strategist with 20 years of experience at major labels. " +
  "You create compelling, genre-authentic marketing copy that resonates with target audiences. " +
  "Always respond with valid JSON matching the exact schema requested.";

/**
 * Uses AI to synthesize Spotify metadata, MusicFlamingo analysis, and web research
 * into ready-to-use marketing copy across multiple channels.
 *
 * @param spotifyData - Artist Spotify metadata and top tracks.
 * @param musicAnalysis - MusicFlamingo AI audio analysis results.
 * @param webContext - Recent web research about the artist.
 * @returns Ready-to-use marketing copy (email, social captions, press release).
 */
export async function buildArtistMarketingCopy(
  spotifyData: ArtistSpotifyData,
  musicAnalysis: ArtistMusicAnalysis | null,
  webContext: ArtistWebContext | null,
): Promise<ArtistMarketingCopy> {
  const { artist, topTracks } = spotifyData;
  const topTrack = topTracks[0];

  const prompt = `Generate marketing copy for ${artist.name}.

Spotify Stats:
- Followers: ${artist.followers.total.toLocaleString()}
- Popularity Score: ${artist.popularity}/100
- Genres: ${artist.genres.slice(0, 3).join(", ") || "not specified"}
- Top Track: "${topTrack?.name || "unknown"}" from "${topTrack?.album?.name || "unknown"}"

AI Music Analysis (NVIDIA MusicFlamingo scan of their audio):
${musicAnalysis ? JSON.stringify(musicAnalysis, null, 2) : "Not available"}

Recent Web Context:
${webContext?.summary || "Not available"}

Generate a JSON response with these EXACT fields:
{
  "playlist_pitch_email": "A compelling 150-word pitch email to Spotify playlist curators. Include artist name, genre, track name, follower count, and why it fits their playlists. Professional but passionate tone.",
  "instagram_caption": "An engaging Instagram caption (under 150 chars) with 5 relevant hashtags. Genre-authentic voice.",
  "tiktok_caption": "A TikTok caption (under 100 chars) with 3 trending hashtags that would drive saves.",
  "twitter_post": "A punchy tweet (under 280 chars) for a new release announcement. Include 2 hashtags.",
  "press_release_opener": "A compelling 3-sentence press release opening paragraph. Professional journalism style.",
  "key_talking_points": ["3-5 bullet points that make this artist unique and compelling to pitch to press, playlists, and sync supervisors"]
}

Respond ONLY with the JSON object. No markdown, no extra text.`;

  try {
    const result = await generateText({ system: SYSTEM_PROMPT, prompt });
    const parsed = JSON.parse(result.text) as ArtistMarketingCopy;
    return parsed;
  } catch (error) {
    console.error("Failed to generate marketing copy:", error);
    const genre = artist.genres[0]?.replace(/\s+/g, "") || "music";
    return {
      playlist_pitch_email: `Dear Curator,\n\nI'd like to introduce you to ${artist.name}, a ${artist.genres[0] || "rising"} artist with ${artist.followers.total.toLocaleString()} Spotify followers and a ${artist.popularity}/100 popularity score. Their track "${topTrack?.name || "latest release"}" would be a perfect fit for your playlist.\n\nBest,\nThe Team`,
      instagram_caption: `New music from ${artist.name} is here 🎵 #newmusic #${genre} #streaming`,
      tiktok_caption: `You need to hear ${artist.name} 🔥 #newmusic #viral #${genre}`,
      twitter_post: `New music alert: ${artist.name} just dropped something special 🎵 #newmusic #${genre}`,
      press_release_opener: `${artist.name} releases their highly anticipated new work, continuing to build momentum in the ${artist.genres[0] || "music"} space. With ${artist.followers.total.toLocaleString()} Spotify followers and a growing global audience, the artist delivers another standout offering. The new release showcases their signature sound and artistic evolution.`,
      key_talking_points: [
        `${artist.followers.total.toLocaleString()} Spotify followers`,
        `Popularity score: ${artist.popularity}/100`,
        `Genre: ${artist.genres.slice(0, 2).join(", ") || "emerging"}`,
      ],
    };
  }
}
