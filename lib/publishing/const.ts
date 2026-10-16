export const POST_PLATFORMS = ["instagram", "x", "linkedin", "youtube"] as const;
export type PostPlatform = (typeof POST_PLATFORMS)[number];

export const POST_STATUSES = ["scheduled", "publishing", "posted", "failed", "cancelled"] as const;

/** Composio toolkit slug that holds each platform's connection. */
export const PLATFORM_TOOLKITS: Record<PostPlatform, string> = {
  instagram: "instagram",
  x: "twitter",
  linkedin: "linkedin",
  youtube: "youtube",
};

/**
 * Per-platform copy limits, as published on the Create Post page. X is
 * measured in weighted characters (see countXWeightedLength).
 */
export const YOUTUBE_TITLE_MAX = 100;
export const YOUTUBE_DESCRIPTION_MAX = 5000;
export const INSTAGRAM_CAPTION_MAX = 2200;
export const X_TEXT_MAX = 280;
export const LINKEDIN_COMMENTARY_MAX = 3000;
