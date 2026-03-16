import { getOrgRepoUrls } from "./getOrgRepoUrls";

/**
 * Builds a map of org repo URL -> count of account repos that have it as a submodule.
 *
 * @param accountGithubRepos - Array of account github_repo URLs
 * @returns Map of normalized repo URL to submodule count
 */
export async function buildSubmoduleCountMap(
  accountGithubRepos: string[],
): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();

  await Promise.all(
    accountGithubRepos.map(async (repoUrl) => {
      try {
        const submoduleUrls = await getOrgRepoUrls(repoUrl);
        for (const url of submoduleUrls) {
          const normalized = url.replace(/\.git$/, "");
          countMap.set(normalized, (countMap.get(normalized) ?? 0) + 1);
        }
      } catch {
        // skip repos that fail
      }
    }),
  );

  return countMap;
}
