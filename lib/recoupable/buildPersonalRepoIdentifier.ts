import { toKebabCase } from "@/lib/string/toKebabCase";
import { RECOUPABLE_GITHUB_OWNER } from "./githubOwner";

/**
 * Returns the `<owner, repo>` pair for an account's personal Recoupable
 * workspace, mirroring `buildPersonalRepoUrl` for callers that talk to
 * the GitHub API directly without re-parsing the URL.
 *
 * Convention: owner = `recoupable`, repo = `<kebab(account_name)>-<account_id>`.
 *
 * Ported from open-agents
 * `apps/web/lib/recoupable/build-personal-repo-identifier.ts` — keep in
 * lockstep with `buildPersonalRepoUrl` and the chat-side helper.
 */
export function buildPersonalRepoIdentifier(params: { accountName: string; accountId: string }): {
  owner: string;
  repo: string;
} {
  const slug = toKebabCase(params.accountName);
  return {
    owner: RECOUPABLE_GITHUB_OWNER,
    repo: `${slug}-${params.accountId}`,
  };
}
