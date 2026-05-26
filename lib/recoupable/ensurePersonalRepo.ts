import { createRepository } from "@/lib/github/createRepository";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { buildPersonalRepoIdentifier } from "./buildPersonalRepoIdentifier";
import { buildPersonalRepoUrl } from "./buildPersonalRepoUrl";
import { RECOUPABLE_GITHUB_OWNER } from "./githubOwner";

export interface EnsurePersonalRepoResult {
  cloneUrl: string;
  repoUrl: string;
  owner: string;
  repoName: string;
}

/**
 * Idempotently ensure an account has a workspace repo at the
 * canonical `recoupable/<accountId>` location.
 *
 *   1. If `recoupable/<accountId>` already exists → return its URL.
 *   2. Otherwise create it with `auto_init: true` so the sandbox has
 *      a `main` branch to clone.
 *
 * Returns `null` only when the GitHub helpers can't get a service
 * token or repo creation outright fails — the caller surfaces that as
 * a 502.
 *
 * Legacy `<slug>-<accountId>` repos are renamed once, ahead of time,
 * by `scripts/migrate-workspace-repo-names.ts`. After that one-shot
 * migration there's no legacy repo to find at runtime, so no
 * rename-on-demand branch lives here.
 */
export async function ensurePersonalRepo(params: {
  accountId: string;
}): Promise<EnsurePersonalRepoResult | null> {
  const { repo: repoName } = buildPersonalRepoIdentifier(params);

  const existing = await repositoryExists({ repo: repoName });

  if (existing === null) {
    console.error(`[ensurePersonalRepo] failed to check ${RECOUPABLE_GITHUB_OWNER}/${repoName}`);
    return null;
  }

  if (existing) {
    return {
      cloneUrl: buildPersonalRepoUrl(params),
      repoUrl: `https://github.com/${RECOUPABLE_GITHUB_OWNER}/${repoName}`,
      owner: RECOUPABLE_GITHUB_OWNER,
      repoName,
    };
  }

  const created = await createRepository({ name: repoName });

  if (!created.success || !created.cloneUrl || !created.repoUrl) {
    console.error(`[ensurePersonalRepo] createRepository failed: ${created.error ?? "unknown"}`);
    return null;
  }

  return {
    cloneUrl: created.cloneUrl,
    repoUrl: created.repoUrl,
    owner: created.owner ?? RECOUPABLE_GITHUB_OWNER,
    repoName: created.repoName ?? repoName,
  };
}
