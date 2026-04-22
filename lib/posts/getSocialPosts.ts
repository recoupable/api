import { selectSocialPostsCount } from "@/lib/supabase/social_posts/selectSocialPostsCount";
import { selectSocialPostsBySocialId } from "@/lib/supabase/social_posts/selectSocialPostsBySocialId";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { selectPostsByIds } from "@/lib/supabase/posts/selectPostsByIds";
import { enrichPostsWithPlatform, type EnrichedPost } from "@/lib/posts/enrichPostsWithPlatform";
import type { GetSocialPostsParams } from "@/lib/posts/validateGetSocialPostsRequest";

export type SocialPostResponseItem = EnrichedPost & { social_id: string };

export interface GetSocialPostsResponse {
  status: "success";
  posts: SocialPostResponseItem[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export async function getSocialPosts(
  params: GetSocialPostsParams,
): Promise<GetSocialPostsResponse> {
  const { social_id, latestFirst, page, limit } = params;
  const offset = (page - 1) * limit;

  const total_count = await selectSocialPostsCount(social_id);
  if (total_count === 0) {
    return {
      status: "success",
      posts: [],
      pagination: { total_count: 0, page, limit, total_pages: 0 },
    };
  }

  const socialPosts = await selectSocialPostsBySocialId({ social_id, offset, limit, latestFirst });
  const socials = (await selectSocials({ id: social_id })) ?? [];
  const rawPosts = await selectPostsByIds(socialPosts.map(sp => sp.post_id));
  const enriched = enrichPostsWithPlatform(rawPosts, socialPosts, socials);

  // selectPostsByIds does not preserve input order — re-order to match the
  // social_posts.updated_at sequence so latestFirst semantics are preserved.
  const byId = new Map(enriched.map(p => [p.id, p]));
  const posts: SocialPostResponseItem[] = [];
  for (const sp of socialPosts) {
    const p = byId.get(sp.post_id);
    if (p) posts.push({ ...p, social_id });
  }

  return {
    status: "success",
    posts,
    pagination: {
      total_count,
      page,
      limit,
      total_pages: Math.ceil(total_count / limit),
    },
  };
}
