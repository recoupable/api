import { createRepository } from "@/lib/github/createRepository";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { RECOUPABLE_GITHUB_OWNER } from "./githubOwner";

/**
 * Idempotently ensure an account has a workspace repo at the
 * canonical `recoupable/<accountId>` location.
 *
 *   1. If `recoupable/<accountId>` already exists → return its URL.
 *   2. Otherwise create it with `auto_init: true` so the sandbox has
 *      a `main` branch to clone, and return the new clone URL.
 *
 * Returns `null` only when the GitHub helpers can't get a service
 * token or repo creation outright fails — the caller surfaces that
 * as a 502. The single-string return matches what callers actually
 * consume (the clone URL); owner / repo name are trivially
 * recoverable from the URL if ever needed.
 *
 * Legacy `<slug>-<accountId>` repos were renamed to the canonical
 * `<accountId>` shape in a one-time backfill (see PR #618), so the
 * runtime never needs to look for a legacy name — every workspace
 * either already lives at `recoupable/<accountId>` or doesn't exist
 * yet.
 */
export async function ensurePersonalRepo(params: { accountId: string }): Promise<string | null> {
  const repoName = params.accountId;
  const repoUrl = `https://github.com/${RECOUPABLE_GITHUB_OWNER}/${repoName}`;

  const existing = await repositoryExists({ repo: repoName });

  if (existing === null) {
    console.error(`[ensurePersonalRepo] failed to check ${RECOUPABLE_GITHUB_OWNER}/${repoName}`);
    return null;
  }

  if (existing) {
    return repoUrl;
  }

  const created = await createRepository({ name: repoName });

  if (!created.success || !created.repoUrl) {
    console.error(`[ensurePersonalRepo] createRepository failed: ${created.error ?? "unknown"}`);
    return null;
  }

  return created.repoUrl;
}
