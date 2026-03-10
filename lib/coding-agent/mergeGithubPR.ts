export type MergeGithubPRResult =
  | { ok: true }
  | { ok: false; message: string };

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
  const error = JSON.parse(errorBody);
  return { ok: false, message: error.message };
}
