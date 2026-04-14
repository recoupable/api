import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";
import { getRepoGitModules } from "./getRepoGitModules";

/**
 * Resolve Submodule Path.
 *
 * @param root0 - Parameter.
 * @param root0.githubRepo - Parameter.
 * @param root0.path - Parameter.
 * @returns - Result.
 */
export async function resolveSubmodulePath({
  githubRepo,
  path,
}: {
  githubRepo: string;
  path: string;
}): Promise<{ githubRepo: string; path: string }> {
  const repoInfo = parseGitHubRepoUrl(githubRepo);
  if (!repoInfo) return { githubRepo, path };

  const submodules = await getRepoGitModules({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    branch: "main",
  });

  if (!submodules) return { githubRepo, path };

  let bestMatch: { subPath: string; url: string } | null = null;
  for (const sub of submodules) {
    if (
      path.startsWith(sub.path + "/") &&
      (!bestMatch || sub.path.length > bestMatch.subPath.length)
    ) {
      bestMatch = { subPath: sub.path, url: sub.url };
    }
  }

  if (!bestMatch) return { githubRepo, path };

  return {
    githubRepo: bestMatch.url,
    path: path.slice(bestMatch.subPath.length + 1),
  };
}
