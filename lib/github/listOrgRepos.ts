export interface GitHubRepo {
  name: string;
  html_url: string;
}

/**
 * Fetches all repositories in the recoupable GitHub org.
 *
 * @param token - GitHub API token
 * @returns Array of GitHubRepo objects
 */
export async function listOrgRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `https://api.github.com/orgs/recoupable/repos?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Recoup-API",
        },
      },
    );

    if (!response.ok) break;

    const batch = (await response.json()) as GitHubRepo[];
    repos.push(...batch);

    if (batch.length < 100) break;
    page++;
  }

  return repos;
}
