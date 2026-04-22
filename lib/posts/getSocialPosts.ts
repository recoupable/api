import { selectSocialPostsCount } from "@/lib/supabase/social_posts/selectSocialPostsCount";
import { selectSocialPostsWithPosts } from "@/lib/supabase/social_posts/selectSocialPostsWithPosts";
import { flattenSocialPosts, type SocialPostResponse } from "@/lib/posts/flattenSocialPosts";
import type { GetSocialPostsParams } from "@/lib/posts/validateGetSocialPostsRequest";

export interface GetSocialPostsResponse {
  status: "success";
  posts: SocialPostResponse[];
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

  const rows = await selectSocialPostsWithPosts({ social_id, offset, limit, latestFirst });
  const posts = flattenSocialPosts(rows);

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
