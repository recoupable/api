import { getOrgRepoUrls } from "./getOrgRepoUrls";

/**
 * Builds a map of org repo URL -> list of account repo URLs that include it as a submodule.
 *
 * @param accountGithubRepos - Array of account github_repo URLs
 * @returns Map of normalized repo URL to array of parent repo URLs
 */
export async function buildSubmoduleRepoMap(
  accountGithubRepos: string[],
): Promise<Map<string, string[]>> {
  const repoMap = new Map<string, string[]>();

  await Promise.all(
    accountGithubRepos.map(async (repoUrl) => {
      try {
        const submoduleUrls = await getOrgRepoUrls(repoUrl);
        for (const url of submoduleUrls) {
          const normalized = url.replace(/\.git$/, "");
          const existing = repoMap.get(normalized) ?? [];
          existing.push(repoUrl);
          repoMap.set(normalized, existing);
        }
      } catch {
        // skip repos that fail
      }
    }),
  );

  return repoMap;
}
