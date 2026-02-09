/**
 * Searches the recoupable GitHub org for repos whose name contains the account ID.
 * Repos are created with the pattern `{sanitized-name}-{accountId}`.
 *
 * @param accountId - The account UUID to search for
 * @returns Array of matching GitHub repo HTML URLs, or empty array on failure
 */
export async function findOrgReposByAccountId(accountId: string): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is not set");
    return [];
  }

  try {
    const response = await fetch(
      `https://api.github.com/orgs/recoupable/repos?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Recoup-API",
        },
      },
    );

    if (!response.ok) {
      console.error(`GitHub API error listing org repos: ${response.status}`);
      return [];
    }

    const repos = (await response.json()) as Array<{ name: string; html_url: string }>;

    return repos
      .filter((repo) => repo.name.includes(accountId))
      .map((repo) => repo.html_url);
  } catch (error) {
    console.error("Error searching org repos:", error);
    return [];
  }
}
