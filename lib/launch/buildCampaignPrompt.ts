import type { LaunchBody } from "./validateLaunchBody";

/**
 * Builds the system prompt for the release campaign generator.
 *
 * @returns The system prompt string
 */
export function buildCampaignSystemPrompt(): string {
  return `You are an expert music industry publicist and marketing strategist with 15+ years of experience
launching indie and major label artists. You write compelling, professional, and authentic music PR content
that sounds human — never generic. Your press releases get picked up by music blogs. Your Spotify pitches
get playlisted. Your emails get replies.

Always write as if this artist and song are genuinely exciting. Use vivid, specific language.
Avoid clichés like "sonic journey" or "genre-defying."
Output each section EXACTLY as instructed with the section markers provided — no extra text outside the markers.`;
}

/**
 * Builds the user prompt for the release campaign generator.
 *
 * @param body - Validated launch request body
 * @returns The formatted user prompt
 */
export function buildCampaignUserPrompt(body: LaunchBody): string {
  const { artist_name, song_name, genre, release_date, description } = body;

  const context = description ? `\nAdditional context: ${description}` : "";

  return `Generate a complete music release campaign for:
Artist: ${artist_name}
Song/Release: ${song_name}
Genre: ${genre}
Release Date: ${release_date}${context}

Generate each section IN ORDER using EXACTLY these markers (do not skip or reorder):

[SECTION:press_release]
Write a professional 2-3 paragraph press release announcing the release. Include a punchy headline, vivid description of the song's sound, the artist's backstory in 1 sentence, and a quote from the artist. End with release date and where to stream.
[/SECTION:press_release]

[SECTION:spotify_pitch]
Write a compelling Spotify editorial pitch (200-250 words). Describe the song's sonic DNA, emotional core, lyrical themes, production style, and which playlists it fits. Include 3 specific Spotify playlist names this would fit.
[/SECTION:spotify_pitch]

[SECTION:instagram_captions]
Write 5 different Instagram captions for the release announcement post. Vary the tone: one hype, one personal/vulnerable, one cryptic/teaser, one funny, one simple & clean. Include 5-8 relevant hashtags for each.
[/SECTION:instagram_captions]

[SECTION:tiktok_hooks]
Write 5 different TikTok video hook scripts. Each hook is the first 3 seconds of a video — punchy, scroll-stopping. Format as: "Hook [N]: [script]". Make them specific to the song's vibe.
[/SECTION:tiktok_hooks]

[SECTION:fan_newsletter]
Write an email newsletter to fans announcing the release. Start with a compelling subject line on its own line (format: "Subject: [subject]"), then the email body. Make it personal, like the artist is writing directly to fans.
[/SECTION:fan_newsletter]

[SECTION:curator_email]
Write a cold email to a playlist curator pitching the song for placement. Keep it under 150 words. Subject line first (format: "Subject: [subject]"), then body. Be specific, not salesy. Include the Spotify link placeholder [SPOTIFY_LINK].
[/SECTION:curator_email]`;
}
