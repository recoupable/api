import type { Tables } from "@/types/database.types";

type Post = Tables<"posts">;
type Social = Tables<"socials">;

export type EnrichedPost = Post & { platform: string };

/**
 * Maps each post → platform via the owning social's `profile_url` keyword.
 * Pure / table-driven so it's reusable across endpoints that return posts
 * (single-social and multi-social callers alike).
 */
export function enrichPostsWithPlatform(
  posts: Post[],
  socialPosts: Array<{ post_id: string; social_id: string }>,
  socials: Social[],
): EnrichedPost[] {
  if (!posts.length) return [];

  return posts.map(post => {
    const sp = socialPosts.find(s => s.post_id === post.id);
    const social = socials.find(s => s.id === sp?.social_id);
    const url = social?.profile_url ?? "";

    let platform = "UNKNOWN";
    if (url.includes("instagram")) platform = "INSTAGRAM";
    else if (url.includes("tiktok")) platform = "TIKTOK";
    else if (url.includes("twitter") || url.includes("x.com")) platform = "TWITTER";
    else if (url.includes("spotify")) platform = "SPOTIFY";

    return { ...post, platform };
  });
}
