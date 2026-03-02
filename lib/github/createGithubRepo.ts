import { sanitizeRepoName } from "./sanitizeRepoName";
import { getExistingGithubRepo } from "./getExistingGithubRepo";

const GITHUB_ORG = "recoupable";

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
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

  const sanitizedName = sanitizeRepoName(accountName);
  const repoName = `${sanitizedName}-${accountId}`;

  try {
    const response = await fetch(`https://api.github.com/orgs/${GITHUB_ORG}/repos`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        name: repoName,
        private: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 422) {
        return getExistingGithubRepo(repoName);
      }

      console.error("Failed to create GitHub repo", {
        status: response.status,
      });
      return undefined;
    }

    const data = (await response.json()) as { html_url: string };
    return data.html_url;
  } catch (error) {
    console.error("Error creating GitHub repo", {
      repoName,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
