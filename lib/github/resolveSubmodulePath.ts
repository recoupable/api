import { parseGitHubRepoUrl } from "./parseGitHubRepoUrl";
import { getRepoGitModules } from "./getRepoGitModules";

/**
 * Resolves a file path that may be inside a git submodule.
 * If the path falls within a submodule, returns the submodule's repo URL
 * and the relative path within it. Otherwise returns the original values.
 *
 * @param githubRepo.githubRepo
 * @param githubRepo - The parent GitHub repository URL
 * @param path - The file path to resolve
 * @param githubRepo.path
 * @returns The resolved repo URL and path
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
