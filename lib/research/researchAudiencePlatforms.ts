/** Existing audience platform aliases and their provider metric sources. */
export const RESEARCH_AUDIENCE_PLATFORM_SOURCES = {
  bandsintown: "bandsintown_followers",
  deezer: "deezer_fans",
  facebook: "facebook_likes",
  instagram: "instagram_followers",
  line: "line_followers",
  melon: "melon_followers",
  soundcloud: "soundcloud_followers",
  spotify: "spotify_streams",
  tiktok: "tiktok_followers",
  twitch: "twitch_followers",
  twitter: "twitter_followers",
  wikipedia: "wikipedia_views",
  youtube_artist: "youtube_artist_subscribers",
  youtube_channel: "youtube_channel_subscribers",
} as const;

export type ResearchAudiencePlatform = keyof typeof RESEARCH_AUDIENCE_PLATFORM_SOURCES;
