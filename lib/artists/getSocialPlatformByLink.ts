/**
 * Determines the social media platform from a profile URL.
 *
 * @param link - The profile URL
 * @returns The platform name (TWITTER, INSTAGRAM, etc.) or "NONE"
 */
export function getSocialPlatformByLink(link: string): string {
  if (!link) return "NONE";
  if (link.includes("x.com") || link.includes("twitter.com")) return "TWITTER";
  if (link.includes("instagram.com")) return "INSTAGRAM";
  if (link.includes("spotify.com")) return "SPOTIFY";
  if (link.includes("tiktok.com")) return "TIKTOK";
  if (link.includes("apple.com")) return "APPLE";
  if (link.includes("youtube.")) return "YOUTUBE";
  if (link.includes("facebook.com")) return "FACEBOOK";
  if (link.includes("threads.net") || link.includes("threads.com")) return "THREADS";

  return "NONE";
}
