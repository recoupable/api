import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

/**
 * Deletes a GitHub repository by its URL.
 *
 * @param githubRepoUrl - The full GitHub repository URL
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteGithubRepo(githubRepoUrl: string): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN environment variable is not set");
    return false;
  }

  const repoInfo = parseGitHubRepoUrl(githubRepoUrl);
  if (!repoInfo) {
    console.error(`Failed to parse GitHub repo URL: ${githubRepoUrl}`);
    return false;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Recoup-API",
        },
      },
    );

    if (response.status === 404) {
      return true;
    }

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `GitHub API error deleting repo ${repoInfo.owner}/${repoInfo.repo}: ${response.status} ${body}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting GitHub repo:", error);
    return false;
  }
}
