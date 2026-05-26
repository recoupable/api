export interface CreateRepositoryResult {
  success: boolean;
  /** GitHub UI URL (`html_url`) — `https://github.com/<owner>/<repo>`. */
  repoUrl?: string;
  /** Git clone URL (`clone_url`) — same shape, used by sandboxes to `git clone`. */
  cloneUrl?: string;
  owner?: string;
  repoName?: string;
  /** Human-readable error message; only set when `success` is false. */
  error?: string;
}

/**
 * Create a GitHub repository under a Recoupable-owned organization.
 *
 * Ported from open-agents `apps/web/lib/github/client.ts#createRepository`
 * with two intentional reductions:
 *   - Plain `fetch` (no Octokit) to match recoup-api's existing
 *     `lib/github/*` style.
 *   - Org-only creation: open-agents allowed a `User` `accountType`
 *     fallback, but Recoupable workspace repos are always created
 *     under the `recoupable` org (see `RECOUPABLE_GITHUB_OWNER`), so
 *     the `createForAuthenticatedUser` branch is unreachable in this
 *     codebase and has been dropped.
 *
 * `auto_init: true` so the repo has an initial `main` branch the
 * sandbox can `git clone`. Without it, a clone of a 0-commit repo
 * fails.
 */
export async function createRepository(params: {
  owner: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
  token: string;
}): Promise<CreateRepositoryResult> {
  const { owner, name, description = "", isPrivate = true, token } = params;

  if (!/^[\w.-]+$/.test(name)) {
    return {
      success: false,
      error:
        "Invalid repository name. Use only letters, numbers, hyphens, underscores, and periods.",
    };
  }

  try {
    const response = await fetch(`https://api.github.com/orgs/${owner}/repos`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      }),
    });

    if (response.status === 201) {
      const data = (await response.json()) as {
        html_url: string;
        clone_url: string;
        owner: { login: string };
        name: string;
      };
      return {
        success: true,
        repoUrl: data.html_url,
        cloneUrl: data.clone_url,
        owner: data.owner.login,
        repoName: data.name,
      };
    }

    if (response.status === 422) {
      return {
        success: false,
        error: "Repository name already exists or is invalid",
      };
    }
    if (response.status === 403) {
      return { success: false, error: "Permission denied" };
    }

    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    console.error(
      `[createRepository] unexpected status ${response.status} for ${owner}/${name}: ${body}`,
    );
    return { success: false, error: `GitHub returned ${response.status}` };
  } catch (error) {
    console.error("[createRepository] network error:", error);
    return { success: false, error: "Network error talking to GitHub" };
  }
}
