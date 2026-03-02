import { getExistingGithubRepo } from "./getExistingGithubRepo";

const GITHUB_ORG = "recoupable";

interface CreateRepoInOrgOptions {
  repoName: string;
  autoInit?: boolean;
}

/**
 * Creates a private GitHub repository in the recoupable organization.
 * Falls back to fetching the existing repo URL on 422 (already exists).
 *
 * @param options - The repo name and optional auto_init flag
 * @returns The repository HTML URL, or undefined on error
 */
export async function createRepoInOrg(options: CreateRepoInOrgOptions): Promise<string | undefined> {
  const { repoName, autoInit } = options;

  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

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
        ...(autoInit ? { auto_init: true } : {}),
      }),
    });

    if (!response.ok) {
      if (response.status === 422) {
        return getExistingGithubRepo(repoName);
      }

      console.error("Failed to create GitHub repo", {
        repoName,
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
