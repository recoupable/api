/**
 * Platform is derived from an embedded social's `profile_url` rather than
 * stored on `posts`, so each row surfaces under its source network. UNKNOWN
 * is a non-fatal sentinel for unmapped platforms and missing linkages.
 */
export function enrichPostWithPlatform<
  P extends {
    social_posts?: Array<{ social?: { profile_url?: string | null } | null } | null> | null;
  },
>(post: P): P & { platform: string } {
  const profileUrls = (post.social_posts ?? [])
    .map(sp => sp?.social?.profile_url ?? "")
    .filter(Boolean);

  for (const url of profileUrls) {
    if (url.includes("instagram")) return { ...post, platform: "INSTAGRAM" };
    if (url.includes("tiktok")) return { ...post, platform: "TIKTOK" };
    if (url.includes("twitter") || url.includes("x.com")) return { ...post, platform: "TWITTER" };
    if (url.includes("spotify")) return { ...post, platform: "SPOTIFY" };
  }
  return { ...post, platform: "UNKNOWN" };
}
