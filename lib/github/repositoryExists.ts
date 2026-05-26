import { RECOUPABLE_GITHUB_OWNER } from "@/lib/recoupable/githubOwner";
import { getServiceGithubToken } from "./getServiceGithubToken";

/**
 * Returns `true` if `recoupable/<repo>` exists, `false` if 404, `null`
 * on any other failure (auth, rate limit, network, missing token).
 * Lets callers distinguish "doesn't exist yet" from "couldn't reach
 * GitHub" before attempting destructive ops like create.
 *
 * Owner is hard-coded to `recoupable` and the GitHub token is read
 * from the environment (per PR #618 review — single source of truth).
 */
export async function repositoryExists(params: { repo: string }): Promise<boolean | null> {
  const { repo } = params;

  const token = getServiceGithubToken();
  if (!token) {
    console.error("[repositoryExists] GITHUB_TOKEN missing");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${RECOUPABLE_GITHUB_OWNER}/${repo}`,
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (response.status === 200) return true;
    if (response.status === 404) return false;

    console.error(
      `[repositoryExists] unexpected status ${response.status} for ${RECOUPABLE_GITHUB_OWNER}/${repo}`,
    );
    return null;
  } catch (error) {
    console.error("[repositoryExists] network error:", error);
    return null;
  }
}
