import {
  getLinkedInPostStats,
  type LinkedInPostStats,
} from "@/lib/publishing/stats/getLinkedInPostStats";
import {
  getLinkedInVideoStats,
  type LinkedInVideoStats,
} from "@/lib/publishing/stats/getLinkedInVideoStats";
import type { LinkedInPostUrn } from "@/lib/publishing/stats/parseLinkedInPostUrn";

/**
 * A company-page post's share statistics and video analytics, read in
 * parallel through the same connection. Rejects only when the share
 * statistics read is rejected; video numbers fall back to null.
 *
 * @param connectedAccountId - The LinkedIn connection that published the post.
 * @param organization - The page's `urn:li:organization:*`.
 * @param post - The post URN and its filter name.
 * @returns The post's share and video numbers, null where LinkedIn omits one.
 */
export async function getLinkedInPostAnalytics(
  connectedAccountId: string,
  organization: string,
  post: LinkedInPostUrn,
): Promise<LinkedInPostStats & LinkedInVideoStats> {
  const [shareStats, videoStats] = await Promise.all([
    getLinkedInPostStats(connectedAccountId, organization, post),
    getLinkedInVideoStats(connectedAccountId, post.urn),
  ]);
  return { ...shareStats, ...videoStats };
}
