import { createRepository } from "@/lib/github/createRepository";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { findLegacyAccountRepo } from "@/lib/github/findLegacyAccountRepo";
import { renameRepository } from "@/lib/github/renameRepository";
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
 * Resolution order:
 *   1. If `recoupable/<accountId>` already exists → return its URL
 *      (clean idempotent case — most calls).
 *   2. Look for a legacy `recoupable/<*>-<accountId>` repo via
 *      GitHub search. If found, rename it to `<accountId>` so the
 *      account's git history follows them onto the new convention.
 *      GitHub auto-redirects the old URL for clones + REST, so any
 *      `sessions.clone_url` rows that still reference the old name
 *      keep working.
 *   3. Otherwise, create a fresh `recoupable/<accountId>` with
 *      `auto_init: true` so the sandbox has a `main` branch to clone.
 *
 * Returns `null` only when the underlying GitHub helpers can't get
 * a service token or repo creation outright fails — the caller
 * surfaces that as a 502.
 *
 * The legacy-rename branch never blocks provisioning: if the search
 * API throws or returns ambiguous results, we fall through to step 3
 * and create a fresh repo. Losing history for an edge-case account is
 * preferable to blocking their session on a flaky GitHub search.
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

  // Try to find and rename a legacy `<slug>-<accountId>` repo so the
  // account's existing code follows them onto the new naming
  // convention without a manual migration step.
  const legacyName = await findLegacyAccountRepo({
    accountId: params.accountId,
  });

  if (legacyName) {
    const renamed = await renameRepository({
      repo: legacyName,
      newName: repoName,
    });
    if (renamed.success) {
      console.log(
        `[ensurePersonalRepo] renamed legacy ${RECOUPABLE_GITHUB_OWNER}/${legacyName} → ${repoName}`,
      );
      return {
        cloneUrl: buildPersonalRepoUrl(params),
        repoUrl: `https://github.com/${RECOUPABLE_GITHUB_OWNER}/${repoName}`,
        owner: RECOUPABLE_GITHUB_OWNER,
        repoName,
      };
    }
    console.error(
      `[ensurePersonalRepo] legacy rename failed (${renamed.error ?? "unknown"}); falling through to create`,
    );
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
