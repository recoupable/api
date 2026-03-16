import { GitHubCommit, GITHUB_API_HEADERS } from "./githubCommit";

/**
 * Fetches the latest N commits for a repository.
 *
 * @param owner - GitHub org/user name
 * @param repo - Repository name
 * @param token - GitHub API token
 * @param perPage - Number of commits to fetch
 * @returns Array of commits or null if the API fails
 */
export async function fetchLatestCommits(
  owner: string,
  repo: string,
  token: string,
  perPage: number,
): Promise<GitHubCommit[] | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`,
    { headers: GITHUB_API_HEADERS(token) },
  );

  if (!response.ok) return null;

  return (await response.json()) as GitHubCommit[];
}
