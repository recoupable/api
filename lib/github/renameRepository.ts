import { RECOUPABLE_GITHUB_OWNER } from "@/lib/recoupable/githubOwner";
import { getServiceGithubToken } from "./getServiceGithubToken";

export interface RenameRepositoryResult {
  success: boolean;
  /** New `clone_url` returned by GitHub on success. */
  cloneUrl?: string;
  /** New `html_url` returned by GitHub on success. */
  repoUrl?: string;
  error?: string;
}

/**
 * Rename a Recoupable workspace repository via
 * `PATCH /repos/{owner}/{repo}`.
 *
 * GitHub automatically issues HTTP redirects from the old name to the
 * new name for both git operations and the REST API, so existing
 * `sessions.clone_url` rows that still reference the old name keep
 * resolving — no DB backfill required.
 *
 * Owner is hard-coded to `recoupable` and the GitHub token is read
 * from the environment (per PR #618 review — single source of truth).
 */
export async function renameRepository(params: {
  repo: string;
  newName: string;
}): Promise<RenameRepositoryResult> {
  const { repo, newName } = params;

  const token = getServiceGithubToken();
  if (!token) {
    console.error("[renameRepository] GITHUB_TOKEN missing");
    return { success: false, error: "GITHUB_TOKEN missing" };
  }

  if (!/^[\w.-]+$/.test(newName)) {
    return {
      success: false,
      error:
        "Invalid repository name. Use only letters, numbers, hyphens, underscores, and periods.",
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${RECOUPABLE_GITHUB_OWNER}/${repo}`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ name: newName }),
      },
    );

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
      `[renameRepository] unexpected status ${response.status} for ${RECOUPABLE_GITHUB_OWNER}/${repo}: ${body}`,
    );
    return { success: false, error: `GitHub returned ${response.status}` };
  } catch (error) {
    console.error("[renameRepository] network error:", error);
    return { success: false, error: "Network error talking to GitHub" };
  }
}
