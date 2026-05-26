import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";
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
 * Idempotently ensures a personal repo exists for the given account.
 *
 * Naming follows `recoupable/<kebab(name)>-<account_id>` (see
 * `buildPersonalRepoUrl`). We check existence with `GET /repos/...`
 * first so a pre-existing repo is a clean no-op; only when the repo
 * is genuinely absent (404) do we attempt creation. Avoids the 422
 * ambiguity where the GitHub API returns the same status for "name
 * taken" and "name invalid".
 *
 * Returns `null` when the service token is missing, the existence
 * check fails for non-404 reasons, or creation fails — all treated
 * as fatal by callers. The caller is responsible for surfacing a
 * user-visible error (`createSessionHandler` returns a 502).
 *
 * Ported from open-agents
 * `apps/web/lib/recoupable/ensure-personal-repo.ts` — keep behavior
 * in lockstep so chat.recoupable.com and sandbox.recoupable.com
 * converge on the same repo for the same account.
 */
export async function ensurePersonalRepo(params: {
  accountName: string;
  accountId: string;
}): Promise<EnsurePersonalRepoResult | null> {
  const token = getServiceGithubToken();
  if (!token) {
    console.error("[ensurePersonalRepo] GITHUB_TOKEN missing; cannot ensure repo");
    return null;
  }

  const { repo: repoName } = buildPersonalRepoIdentifier({
    accountName: params.accountName,
    accountId: params.accountId,
  });

  const existing = await repositoryExists({
    owner: RECOUPABLE_GITHUB_OWNER,
    repo: repoName,
    token,
  });

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

  const created = await createRepository({
    owner: RECOUPABLE_GITHUB_OWNER,
    name: repoName,
    description: `Personal Recoupable workspace for account ${params.accountId}`,
    isPrivate: true,
    token,
  });

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
