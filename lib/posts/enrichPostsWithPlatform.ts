export interface EnrichInputPost {
  [key: string]: unknown;
  id: string;
}

export interface EnrichInputSocialPost {
  post_id: string;
  social_id: string;
}

export interface EnrichInputSocial {
  id: string;
  profile_url: string;
}

export type EnrichedPost<P extends EnrichInputPost> = P & { platform: string };

/**
 * Platform is derived from the first matching social's `profile_url` rather
 * than stored on `posts`, so the same row can be surfaced as the appropriate
 * platform per social linkage. UNKNOWN is a sentinel for unmapped platforms
 * and missing social linkages; callers treat it as non-fatal.
 */
export function enrichPostsWithPlatform<P extends EnrichInputPost>(
  posts: P[],
  socialPosts: EnrichInputSocialPost[],
  socials: EnrichInputSocial[],
): EnrichedPost<P>[] {
  if (!posts.length) return [];

  return posts.map(post => {
    const socialPost = socialPosts.find(sp => sp.post_id === post.id);
    const social = socials.find(s => s.id === socialPost?.social_id);
    const url = social?.profile_url ?? "";

    let platform = "UNKNOWN";
    if (url.includes("instagram")) platform = "INSTAGRAM";
    else if (url.includes("tiktok")) platform = "TIKTOK";
    else if (url.includes("twitter") || url.includes("x.com")) platform = "TWITTER";
    else if (url.includes("spotify")) platform = "SPOTIFY";

    return { ...post, platform };
  });
}
