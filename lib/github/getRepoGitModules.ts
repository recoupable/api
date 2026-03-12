import { parseGitModules, type SubmoduleEntry } from "./parseGitModules";

/**
 * Fetches and parses .gitmodules from a GitHub repository.
 *
 * @param owner.owner
 * @param owner - The GitHub repository owner
 * @param repo - The GitHub repository name
 * @param branch - The branch to fetch from
 * @param owner.repo
 * @param owner.branch
 * @returns Array of submodule entries, or null if .gitmodules doesn't exist or fetch fails
 */
export async function getRepoGitModules({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<SubmoduleEntry[] | null> {
  const token = process.env.GITHUB_TOKEN;

  const response = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.gitmodules`,
    { ...(token && { headers: { Authorization: `Bearer ${token}` } }) },
  );

  if (!response.ok) {
    return null;
  }

  const content = await response.text();
  return parseGitModules(content);
}
