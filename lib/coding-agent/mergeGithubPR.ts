export interface MergeGithubPRSuccess {
  ok: true;
}

export interface MergeGithubPRFailure {
  ok: false;
  message: string;
}

export type MergeGithubPRResult = MergeGithubPRSuccess | MergeGithubPRFailure;

/**
 * Merge Github PR.
 *
 * @param repo - Value for repo.
 * @param prNumber - Value for prNumber.
 * @param token - Authentication token.
 * @returns - Computed result.
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
  const error = JSON.parse(errorBody);
  return { ok: false, message: error.message };
}
