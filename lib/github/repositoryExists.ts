/**
 * Returns `true` if `<owner>/<repo>` exists, `false` if 404, `null` on
 * any other failure (auth, rate limit, network). Lets callers
 * distinguish "doesn't exist yet" from "couldn't reach GitHub" before
 * attempting destructive ops like create.
 *
 * Ported from open-agents `apps/web/lib/github/repository-exists.ts` —
 * recoup-api uses plain `fetch` rather than Octokit to match the
 * existing `lib/github/*` style.
 *
 * @param owner - GitHub owner (org or user login).
 * @param repo - Repository name (the part after the slash).
 * @param token - GitHub PAT or service token. Required — public
 *   `GET /repos/{owner}/{repo}` is rate-limited and private repos 404
 *   when unauthenticated, so an unauthenticated probe is ambiguous.
 */
export async function repositoryExists(params: {
  owner: string;
  repo: string;
  token: string;
}): Promise<boolean | null> {
  const { owner, repo, token } = params;
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (response.status === 200) return true;
    if (response.status === 404) return false;

    console.error(`[repositoryExists] unexpected status ${response.status} for ${owner}/${repo}`);
    return null;
  } catch (error) {
    console.error("[repositoryExists] network error:", error);
    return null;
  }
}
