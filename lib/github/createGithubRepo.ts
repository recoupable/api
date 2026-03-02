import { sanitizeRepoName } from "./sanitizeRepoName";
import { createRepoInOrg } from "./createRepoInOrg";

/**
 * Creates a private GitHub repository in the recoupable organization.
 *
 * @param accountName - The account display name
 * @param accountId - The account UUID
 * @returns The repository HTML URL, or undefined on error
 */
export async function createGithubRepo(
  accountName: string,
  accountId: string,
): Promise<string | undefined> {
  const sanitizedName = sanitizeRepoName(accountName);
  const repoName = `${sanitizedName}-${accountId}`;

  return createRepoInOrg({ repoName });
}
