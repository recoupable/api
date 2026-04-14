import { parseGitModules, type SubmoduleEntry } from "./parseGitModules";

/**
 * Get Repo Git Modules.
 *
 * @param root0 - Parameter.
 * @param root0.owner - Parameter.
 * @param root0.repo - Parameter.
 * @param root0.branch - Parameter.
 * @returns - Result.
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
    `https://api.github.com/repos/${owner}/${repo}/contents/.gitmodules?ref=${branch}`,
    {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": "Recoup-API",
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const content = await response.text();
  return parseGitModules(content);
}
