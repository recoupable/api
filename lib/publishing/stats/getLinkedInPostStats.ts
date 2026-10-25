import { proxyLinkedIn } from "@/lib/publishing/proxyLinkedIn";
import type { LinkedInPostUrn } from "@/lib/publishing/stats/parseLinkedInPostUrn";

const ENDPOINT = "https://api.linkedin.com/rest/organizationalEntityShareStatistics";

export type LinkedInPostStats = {
  impressions: number | null;
  unique_impressions: number | null;
  clicks: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
};

const num = (value: unknown): number | null => (typeof value === "number" ? value : null);

/**
 * A company-page post's lifetime totals from LinkedIn's Organization Share
 * Statistics, read through the connection that published it. Rest.li 2.0:
 * the `List()` parentheses stay literal and the URNs inside are encoded.
 * Throws when LinkedIn rejects the read (see proxyLinkedIn).
 *
 * @param connectedAccountId - The LinkedIn connection that published the post.
 * @param organization - The page's `urn:li:organization:*`.
 * @param post - The post URN and its filter name.
 * @returns The post's numbers, null where LinkedIn omits one.
 */
export async function getLinkedInPostStats(
  connectedAccountId: string,
  organization: string,
  post: LinkedInPostUrn,
): Promise<LinkedInPostStats> {
  const url =
    `${ENDPOINT}?q=organizationalEntity` +
    `&organizationalEntity=${encodeURIComponent(organization)}` +
    `&${post.kind}=List(${encodeURIComponent(post.urn)})`;
  const { data } = await proxyLinkedIn(connectedAccountId, "GET", url);

  const elements = (data.elements ?? []) as {
    ugcPost?: string;
    share?: string;
    totalShareStatistics?: Record<string, unknown>;
  }[];
  const field = post.kind === "ugcPosts" ? "ugcPost" : "share";
  const totals = elements.find(element => element[field] === post.urn)?.totalShareStatistics ?? {};

  return {
    impressions: num(totals.impressionCount),
    unique_impressions: num(totals.uniqueImpressionsCount),
    clicks: num(totals.clickCount),
    likes: num(totals.likeCount),
    comments: num(totals.commentCount),
    shares: num(totals.shareCount),
    engagement: num(totals.engagement),
  };
}
