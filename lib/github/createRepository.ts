import { RECOUPABLE_GITHUB_OWNER } from "@/lib/recoupable/githubOwner";
import { getServiceGithubToken } from "./getServiceGithubToken";

export interface CreateRepositoryResult {
  success: boolean;
  /** GitHub UI URL (`html_url`). */
  repoUrl?: string;
  /** Git clone URL (`clone_url`). */
  cloneUrl?: string;
  /** Owner login (always `recoupable`). */
  owner?: string;
  repoName?: string;
  /** Human-readable error message; only set when `success` is false. */
  error?: string;
}

/**
 * Create a workspace repository under the Recoupable GitHub org.
 *
 * Hard-coded conventions (per PR #618 review — KISS / YAGNI):
 *   - owner = `recoupable` (no other owner makes sense; see
 *     `RECOUPABLE_GITHUB_OWNER`).
 *   - private = true (matches the 153 legacy workspace repos that
 *     pre-date this code path — keeps the fleet uniform; clones from
 *     sandboxes auth via the GITHUB_TOKEN service token).
 *   - description = none (GitHub doesn't render anything meaningful
 *     for these per-account repos).
 *   - token = read once from `GITHUB_TOKEN` via
 *     `getServiceGithubToken` (single source of truth — callers no
 *     longer thread the token through).
 *
 * `auto_init: true` so the repo has an initial `main` branch the
 * sandbox can `git clone`. Without it, cloning a 0-commit repo fails.
 *
 * Uses plain `fetch` to match recoup-api's existing `lib/github/*`
 * style (no Octokit dependency).
 */
export async function createRepository(params: { name: string }): Promise<CreateRepositoryResult> {
  const { name } = params;

  const token = getServiceGithubToken();
  if (!token) {
    console.error("[createRepository] GITHUB_TOKEN missing");
    return { success: false, error: "GITHUB_TOKEN missing" };
  }

  if (!/^[\w.-]+$/.test(name)) {
    return {
      success: false,
      error:
        "Invalid repository name. Use only letters, numbers, hyphens, underscores, and periods.",
    };
  }

  try {
    const response = await fetch(`https://api.github.com/orgs/${RECOUPABLE_GITHUB_OWNER}/repos`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        name,
        private: true,
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
      `[createRepository] unexpected status ${response.status} for ${RECOUPABLE_GITHUB_OWNER}/${name}: ${body}`,
    );
    return { success: false, error: `GitHub returned ${response.status}` };
  } catch (error) {
    console.error("[createRepository] network error:", error);
    return { success: false, error: "Network error talking to GitHub" };
  }
}
