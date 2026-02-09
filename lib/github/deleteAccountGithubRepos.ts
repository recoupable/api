import { deleteGithubRepo } from "./deleteGithubRepo";
import { findOrgReposByAccountId } from "./findOrgReposByAccountId";

/**
 * Deletes all GitHub repos for an account. Combines the snapshot's github_repo URL
 * with a search of the recoupable org for repos matching the account ID.
 *
 * @param accountId - The account ID
 * @param githubRepoUrl - The github_repo URL from the snapshot, if any
 * @returns true if all deletions succeeded or nothing to delete, false if any deletion failed
 */
export async function deleteAccountGithubRepos(
  accountId: string,
  githubRepoUrl: string | null,
): Promise<boolean> {
  const repoUrls: string[] = [];

  if (githubRepoUrl) {
    repoUrls.push(githubRepoUrl);
  }

  const orgRepos = await findOrgReposByAccountId(accountId);
  for (const url of orgRepos) {
    if (!repoUrls.includes(url)) {
      repoUrls.push(url);
    }
  }

  if (repoUrls.length === 0) {
    return true;
  }

  for (const url of repoUrls) {
    const deleted = await deleteGithubRepo(url);
    if (!deleted) {
      return false;
    }
  }

  return true;
}
