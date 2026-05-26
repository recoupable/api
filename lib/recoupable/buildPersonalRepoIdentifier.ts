import { RECOUPABLE_GITHUB_OWNER } from "./githubOwner";

/**
 * Returns the `<owner, repo>` pair for an account's Recoupable
 * workspace repo. The repo name is the account UUID with no slug
 * prefix — keeps the lookup stable across account renames and unifies
 * the personal vs. org repo naming so every workspace repo is keyed
 * the same way.
 *
 * Convention: `recoupable/<accountId>`.
 *
 * Account names are mutable (`account_info.name` can be edited at any
 * time), so any naming scheme that embeds the name eventually drifts
 * — see [[feedback_unified_workspace_repo_naming]] for the design call
 * to drop the slug entirely.
 */
export function buildPersonalRepoIdentifier(params: { accountId: string }): {
  owner: string;
  repo: string;
} {
  return { owner: RECOUPABLE_GITHUB_OWNER, repo: params.accountId };
}
