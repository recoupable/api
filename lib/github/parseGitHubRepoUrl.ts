export interface GitHubRepoInfo {
  owner: string;
  repo: string;
}

/**
 * Parses a GitHub repository URL and extracts the owner and repo name.
 *
 * @param url - A GitHub repository URL
 * @returns The owner and repo, or null if the URL is not valid
 */
export function parseGitHubRepoUrl(url: string): GitHubRepoInfo | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    const owner = segments[0];
    const repo = segments[1].replace(/\.git$/, "");

    if (!owner || !repo) return null;

    return { owner, repo };
  } catch {
    return null;
  }
}
