import { upsertPosts } from "@/lib/supabase/posts/upsertPosts";
import { getPosts } from "@/lib/supabase/posts/getPosts";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { upsertSocialPosts } from "@/lib/supabase/social_posts/upsertSocialPosts";
import type { Tables, TablesInsert } from "@/types/database.types";

type PersistPostsForSocialParams = {
  postRows: TablesInsert<"posts">[];
  profileUrl: string;
};

/**
 * Persists scraped post rows and links them to the social row matching
 * `profileUrl` — the posts half of what the Instagram profile handler does,
 * shared by the TikTok and X/Twitter handlers (recoupable/chat#1840).
 *
 * Call after `upsertSocials` so the social row exists for first-seen
 * profiles. `profileUrl` must be the same normalized key the caller
 * upserted, or the lookup misses and posts persist unlinked.
 *
 * @param params - Post rows plus the normalized social profile_url to link to
 * @returns The persisted posts and the linked social row (null when not found)
 */
export async function persistPostsForSocial({ postRows, profileUrl }: PersistPostsForSocialParams) {
  if (postRows.length === 0) return { posts: [], social: null };

  await upsertPosts(postRows);
  const posts = await getPosts({ postUrls: postRows.map(p => p.post_url) });

  const matches = await selectSocials({ profile_url: profileUrl });
  const social: Tables<"socials"> | null = matches?.[0] ?? null;

  if (social && posts.length) {
    await upsertSocialPosts(
      posts.map(post => ({
        post_id: post.id,
        social_id: social.id,
        updated_at: post.updated_at,
      })),
    );
  }

  return { posts, social };
}
