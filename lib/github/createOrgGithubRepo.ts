import { sanitizeRepoName } from "./sanitizeRepoName";
import { createRepoInOrg } from "./createRepoInOrg";

/**
 * Creates a private GitHub repository for an organization in the
 * recoupable GitHub organization.
 *
 * Repo naming: `org-{sanitizedName}-{orgId}`
 *
 * @param orgName - The organization display name
 * @param orgId - The organization UUID
 * @returns The repository HTML URL, or undefined on error
 */
export async function createOrgGithubRepo(
  orgName: string,
  orgId: string,
): Promise<string | undefined> {
  const sanitizedName = sanitizeRepoName(orgName);
  const repoName = `org-${sanitizedName}-${orgId}`;

  return createRepoInOrg({ repoName, autoInit: true });
}
