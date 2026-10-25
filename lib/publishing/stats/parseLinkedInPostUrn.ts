export type LinkedInPostUrn = {
  urn: string;
  kind: "ugcPosts" | "shares";
};

/**
 * The post URN inside a LinkedIn post URL, as publishLinkedIn stores it
 * (`https://www.linkedin.com/feed/update/<urn>/`).
 *
 * @param postUrl - The post's live URL.
 * @returns The URN and the share-statistics filter it belongs to, or null.
 */
export function parseLinkedInPostUrn(postUrl: string): LinkedInPostUrn | null {
  const match = postUrl.match(/urn:li:(ugcPost|share):\d+/);
  if (!match) return null;
  return { urn: match[0], kind: match[1] === "ugcPost" ? "ugcPosts" : "shares" };
}
