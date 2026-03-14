import { getRepoGitModules } from "./getRepoGitModules";
import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";

/**
 * Gets the GitHub URLs of all org submodule repos for a sandbox repository.
 *
 * Reads .gitmodules from the main repo and extracts the submodule URLs.
 * Used by content readiness checks and artist file fetching.
 *
 * @param githubRepoUrl - Full GitHub repo URL (e.g. https://github.com/org/repo)
 * @param branch - Branch to read .gitmodules from (defaults to "main")
 * @returns Array of org repo URLs, or empty array if none found
 */
export async function getOrgRepoUrls(githubRepoUrl: string, branch = "main"): Promise<string[]> {
  const repoInfo = parseGitHubRepoUrl(githubRepoUrl);
  if (!repoInfo) return [];

  const submodules = await getRepoGitModules({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    branch,
  });

  if (!submodules) return [];

  return submodules.map(s => s.url);
}
