import { GITHUB_API_HEADERS } from "./githubCommit";
import { parseLinkHeaderLastPage } from "./parseLinkHeaderLastPage";

/**
 * Fetches the total commit count for a repository using the Link header pagination trick.
 *
 * @param owner - GitHub org/user name
 * @param repo - Repository name
 * @param token - GitHub API token
 * @returns Total commit count or null if the API fails
 */
export async function fetchRepoCommitCount(
  owner: string,
  repo: string,
  token: string,
): Promise<number | null> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
    headers: GITHUB_API_HEADERS(token),
  });

  if (!response.ok) return null;

  const linkHeader = response.headers.get("Link");
  return parseLinkHeaderLastPage(linkHeader);
}
