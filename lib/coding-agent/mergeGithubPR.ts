export interface MergeGithubPRSuccess {
  ok: true;
}

export interface MergeGithubPRFailure {
  ok: false;
  message: string;
}

export type MergeGithubPRResult = MergeGithubPRSuccess | MergeGithubPRFailure;

/**
 * Squash-merges a GitHub pull request via the API.
 *
 * @param repo - Full repo identifier (e.g. "recoupable/api")
 * @param prNumber - PR number to merge
 * @param token - GitHub API token
 */
export async function mergeGithubPR(
  repo: string,
  prNumber: number,
  token: string,
): Promise<MergeGithubPRResult> {
  const [owner, repoName] = repo.split("/");
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ merge_method: "squash" }),
    },
  );

  if (response.ok) {
    return { ok: true };
  }

  const errorBody = await response.text();
  console.error(
    `[coding-agent] merge failed for ${repo}#${prNumber}: ${response.status} ${errorBody}`,
  );
  let message = `GitHub merge failed (HTTP ${response.status})`;
  try {
    const error: unknown = JSON.parse(errorBody);
    if (
      error !== null &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.trim().length > 0
    ) {
      message = error.message;
    }
  } catch {
    // Failed HTTP responses may contain HTML, plain text, or an empty body.
  }
  return { ok: false, message };
}
