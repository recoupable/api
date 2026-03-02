const GITHUB_ORG = "recoupable";

/**
 * Fetches an existing GitHub repository URL from the recoupable organization.
 *
 * @param repoName - The full repository name (e.g. "account-name-uuid")
 * @returns The repository HTML URL, or undefined if not found or on error
 */
export async function getExistingGithubRepo(repoName: string): Promise<string | undefined> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_ORG}/${repoName}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch existing GitHub repo", {
        status: response.status,
      });
      return undefined;
    }

    const data = (await response.json()) as { html_url: string };
    return data.html_url;
  } catch (error) {
    console.error("Error fetching existing GitHub repo", {
      repoName,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
