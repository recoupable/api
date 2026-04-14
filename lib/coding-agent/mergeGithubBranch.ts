export interface MergeGithubBranchSuccess {
  ok: true;
}

export interface MergeGithubBranchFailure {
  ok: false;
  message: string;
}

export type MergeGithubBranchResult = MergeGithubBranchSuccess | MergeGithubBranchFailure;

/**
 * Merge Github Branch.
 *
 * @param repo - Value for repo.
 * @param head - Value for head.
 * @param base - Value for base.
 * @param token - Authentication token.
 * @returns - Computed result.
 */
export async function mergeGithubBranch(
  repo: string,
  head: string,
  base: string,
  token: string,
): Promise<MergeGithubBranchResult> {
  const [owner, repoName] = repo.split("/");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/merges`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      base,
      head,
      commit_message: `Merge ${head} into ${base}`,
    }),
  });

  // 201 = merged, 204 = already up to date (both are success)
  if (response.ok) {
    return { ok: true };
  }

  const errorBody = await response.text();
  console.error(
    `[coding-agent] branch merge failed for ${repo} (${head} → ${base}): ${response.status} ${errorBody}`,
  );
  const error = JSON.parse(errorBody);
  return { ok: false, message: error.message };
}
