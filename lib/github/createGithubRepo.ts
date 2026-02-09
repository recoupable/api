import { sanitizeRepoName } from "./sanitizeRepoName";

const GITHUB_ORG = "recoupable";

/**
 * Creates a private GitHub repository in the recoupable organization.
 * If the repo already exists (422), fetches and returns the existing repo URL.
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

    if (response.ok) {
      const data = (await response.json()) as { html_url: string };
      return data.html_url;
    }

    // 422 means the repo already exists - fetch the existing one
    if (response.status === 422) {
      const existingResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_ORG}/${repoName}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (existingResponse.ok) {
        const data = (await existingResponse.json()) as { html_url: string };
        return data.html_url;
      }
    }

    const errorText = await response.text();
    console.error("Failed to create GitHub repo", {
      status: response.status,
      error: errorText,
    });
    return undefined;
  } catch (error) {
    console.error("Error creating GitHub repo", {
      repoName,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
