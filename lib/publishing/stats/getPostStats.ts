import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { parseLinkedInPostUrn } from "@/lib/publishing/stats/parseLinkedInPostUrn";
import { getLinkedInPostAnalytics } from "@/lib/publishing/stats/getLinkedInPostAnalytics";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { chargePostStatsRead } from "@/lib/publishing/stats/chargePostStatsRead";
import { POST_STATS_CREDITS } from "@/lib/publishing/stats/postStatsCredits";

const ORGANIZATION_PREFIX = "urn:li:organization:";

export interface GetPostStatsParams {
  /** The authenticated caller, who must reach the post's account and pays for the read. */
  accountId: string;
  /** The post's id. */
  postId: string;
}

export type PostStats = {
  post_id: string;
  platform: string;
  post_url: string;
  as_of: string;
} & Awaited<ReturnType<typeof getLinkedInPostAnalytics>>;

export type GetPostStatsResult =
  | { kind: "ok"; stats: PostStats }
  | { kind: "insufficient_credits"; remainingCredits: number; requiredCredits: number }
  | { kind: "rejected"; status: 403 | 404 | 409 | 422 | 502; message: string };

const reject = (status: 403 | 404 | 409 | 422 | 502, message: string): GetPostStatsResult => ({
  kind: "rejected",
  status,
  message,
});

/**
 * A published post's own platform numbers, read live through the connection
 * that published it. LinkedIn company-page posts only. Credits ($0.001) are
 * checked before LinkedIn is called and charged only after a successful read.
 * Shared by `GET /api/posts/{id}/stats` and the `get_published_post_stats` MCP
 * tool, which map the result to their own response shapes. Database errors
 * propagate to the caller.
 *
 * @param params - See {@link GetPostStatsParams}.
 * @returns The stats, the credit shortfall, or a rejection with its REST status and message.
 */
export async function getPostStats({
  accountId,
  postId,
}: GetPostStatsParams): Promise<GetPostStatsResult> {
  const [row] = await selectScheduledPosts({ id: postId });
  if (!row) return reject(404, "Post not found");

  const allowed = await canAccessAccount({
    currentAccountId: accountId,
    targetAccountId: row.account_id,
  });
  if (!allowed) return reject(403, "Access denied to this post's account");

  if (row.status !== "posted" || !row.post_url) {
    return reject(409, "Post is not published yet, so it has no stats");
  }
  if (row.platform !== "linkedin") {
    return reject(422, `Stats are not available for ${row.platform} posts yet`);
  }
  const organization = row.sub_account_id;
  if (!organization?.startsWith(ORGANIZATION_PREFIX)) {
    return reject(422, "Stats are available for LinkedIn company-page posts only");
  }
  const post = parseLinkedInPostUrn(row.post_url);
  if (!post) return reject(422, "post_url does not name a LinkedIn post");

  const connectedAccountId = await findConnectedAccountId(
    row.artist_account_id ?? row.account_id,
    "linkedin",
  );
  if (!connectedAccountId) return reject(409, "linkedin is not connected for this account");

  const gate = await checkCreditsAvailable({ accountId, creditsToDeduct: POST_STATS_CREDITS });
  if (gate.kind === "insufficient_credits") {
    return {
      kind: "insufficient_credits",
      remainingCredits: gate.remainingCredits,
      requiredCredits: gate.requiredCredits,
    };
  }

  let metrics;
  try {
    metrics = await getLinkedInPostAnalytics(connectedAccountId, organization, post);
  } catch (error) {
    console.error("LinkedIn rejected the post stats read:", error);
    return reject(502, "LinkedIn rejected the stats read for this post");
  }

  await chargePostStatsRead(accountId, row.platform, row.post_url);

  return {
    kind: "ok",
    stats: {
      post_id: row.id,
      platform: row.platform,
      post_url: row.post_url,
      ...metrics,
      as_of: new Date().toISOString(),
    },
  };
}
