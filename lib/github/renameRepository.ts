export interface RenameRepositoryResult {
  success: boolean;
  /** New `clone_url` returned by GitHub on success. */
  cloneUrl?: string;
  /** New `html_url` returned by GitHub on success. */
  repoUrl?: string;
  error?: string;
}

/**
 * Rename a GitHub repository via `PATCH /repos/{owner}/{repo}`.
 *
 * GitHub automatically issues HTTP redirects from the old name to the
 * new name for both git operations and the REST API, so existing
 * `sessions.clone_url` rows that still reference the old name keep
 * resolving after the rename — no DB backfill required for clone_url
 * (the migration script only renames repos, not stored URLs).
 *
 * Uses plain `fetch` to match recoup-api's existing `lib/github/*`
 * style (no Octokit dependency).
 */
export async function renameRepository(params: {
  owner: string;
  repo: string;
  newName: string;
  token: string;
}): Promise<RenameRepositoryResult> {
  const { owner, repo, newName, token } = params;

  if (!/^[\w.-]+$/.test(newName)) {
    return {
      success: false,
      error:
        "Invalid repository name. Use only letters, numbers, hyphens, underscores, and periods.",
    };
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ name: newName }),
    });

    if (response.status === 200) {
      const data = (await response.json()) as {
        html_url: string;
        clone_url: string;
      };
      return {
        success: true,
        cloneUrl: data.clone_url,
        repoUrl: data.html_url,
      };
    }

    if (response.status === 422) {
      return {
        success: false,
        error: "Target repository name already exists or is invalid",
      };
    }
    if (response.status === 403) {
      return { success: false, error: "Permission denied" };
    }
    if (response.status === 404) {
      return { success: false, error: "Source repository not found" };
    }

    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    console.error(
      `[renameRepository] unexpected status ${response.status} for ${owner}/${repo}: ${body}`,
    );
    return { success: false, error: `GitHub returned ${response.status}` };
  } catch (error) {
    console.error("[renameRepository] network error:", error);
    return { success: false, error: "Network error talking to GitHub" };
  }
}
