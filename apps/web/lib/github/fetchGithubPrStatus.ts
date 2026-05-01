export type PrStatus = "open" | "closed" | "merged";

/**
 * Fetches the status of a GitHub pull request via the GitHub REST API.
 *
 * @param prUrl - The GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)
 * @returns "open", "closed", or "merged"
 */
export async function fetchGithubPrStatus(prUrl: string): Promise<PrStatus> {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return "closed";

  const [, owner, repo, number] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;

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
    if (!res.ok) return "closed";

    const data = (await res.json()) as { state: string; merged: boolean };

    if (data.merged) return "merged";
    if (data.state === "open") return "open";
    return "closed";
  } catch {
    return "closed";
  }
}
