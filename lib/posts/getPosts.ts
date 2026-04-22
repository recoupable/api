import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { selectSocialPostsBySocialIds } from "@/lib/supabase/social_posts/selectSocialPostsBySocialIds";
import { selectPostsByIds } from "@/lib/supabase/posts/selectPostsByIds";
import { enrichPostsWithPlatform } from "@/lib/posts/enrichPostsWithPlatform";
import type { GetPostsParams } from "@/lib/posts/validateGetPostsRequest";

const MAX_SOCIALS_PER_ARTIST = 10000;

function emptyResponse(page: number, limit: number) {
  return {
    status: "success" as const,
    posts: [] as Array<Record<string, unknown>>,
    pagination: { total_count: 0, page, limit, total_pages: 1 },
  };
}

/**
 * Dedup + slice + fetch-by-id is preserved from the Express source to keep
 * `pagination.total_count` byte-identical across migrations; a DB-side
 * `count(distinct post_id)` would drift observably.
 */
export async function getPosts({ artist_account_id, page, limit }: GetPostsParams) {
  const accountSocials = await selectAccountSocials({
    accountId: artist_account_id,
    limit: MAX_SOCIALS_PER_ARTIST,
  });

  const socials = accountSocials
    .map(row => row.social)
    .filter((s): s is NonNullable<typeof s> => !!s);

  if (!socials.length) return emptyResponse(page, limit);

  const socialIds = socials.map(s => s.id);
  const socialPosts = await selectSocialPostsBySocialIds(socialIds);
  if (!socialPosts.length) return emptyResponse(page, limit);

  const uniquePostIds = Array.from(
    new Set(socialPosts.map(sp => sp.post_id).filter((id): id is string => !!id)),
  );

  const total = uniquePostIds.length;
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, total);
  const paginatedPostIds = uniquePostIds.slice(startIndex, endIndex);

  const rawPosts = paginatedPostIds.length ? await selectPostsByIds(paginatedPostIds) : [];

  const posts = enrichPostsWithPlatform(
    rawPosts,
    socialPosts,
    socials.map(s => ({ id: s.id, profile_url: s.profile_url })),
  );

  return {
    status: "success" as const,
    posts,
    pagination: {
      total_count: total,
      page,
      limit,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
}
