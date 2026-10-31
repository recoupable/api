export interface MergeGithubBranchSuccess {
  ok: true;
}

export interface MergeGithubBranchFailure {
  ok: false;
  message: string;
}

export type MergeGithubBranchResult = MergeGithubBranchSuccess | MergeGithubBranchFailure;

/**
 * Merges one branch into another via the GitHub API.
 *
 * @param repo - Full repo identifier (e.g. "recoupable/api")
 * @param head - Branch to merge from (e.g. "test")
 * @param base - Branch to merge into (e.g. "main")
 * @param token - GitHub API token
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
  let message = `GitHub branch merge failed (HTTP ${response.status})`;
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
