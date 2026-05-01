import { GitHubCommit, GITHUB_API_HEADERS } from "./githubCommit";

/**
 * Fetches the earliest commit for a repository by requesting the last page.
 *
 * @param owner - GitHub org/user name
 * @param repo - Repository name
 * @param token - GitHub API token
 * @param lastPage - The last page number (total commit count)
 * @returns The earliest commit or null if the API fails or no commits found
 */
export async function fetchEarliestCommit(
  owner: string,
  repo: string,
  token: string,
  lastPage: number,
): Promise<GitHubCommit | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1&page=${lastPage}`,
    { headers: GITHUB_API_HEADERS(token) },
  );

  if (!response.ok) return null;

  const commits = (await response.json()) as GitHubCommit[];
  return commits.length > 0 ? commits[0] : null;
}
