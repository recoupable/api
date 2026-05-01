/**
 * Parses the GitHub API Link header to extract the last page number.
 * Returns 1 if no Link header or no "last" relation found.
 *
 * @param linkHeader - The Link header value from a GitHub API response
 * @returns The last page number
 */
export function parseLinkHeaderLastPage(linkHeader: string | null): number {
  if (!linkHeader) return 1;
  const match = linkHeader.match(/[?&]page=(\d+)>; rel="last"/);
  return match ? parseInt(match[1], 10) : 1;
}
