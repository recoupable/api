/**
 * Checks whether a GitHub pull request is merged via the GitHub REST API.
 * Parses the PR URL to extract owner, repo, and PR number.
 * Uses the GITHUB_TOKEN env var for authentication if available.
 *
 * @param prUrl - The GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)
 * @returns true if the PR is merged, false if not merged or if the URL is invalid
 */
export async function fetchGithubPrMergedStatus(prUrl: string): Promise<boolean> {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return false;

  const [, owner, repo, number] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/merge`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(apiUrl, { headers });
    // GitHub returns 204 if merged, 404 if not merged
    return res.status === 204;
  } catch {
    return false;
  }
}
