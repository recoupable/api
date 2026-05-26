import { buildPersonalRepoIdentifier } from "./buildPersonalRepoIdentifier";

/**
 * Builds the GitHub URL for an account's per-account ("personal")
 * repository, used as the fallback when the user has no Recoupable
 * organization selected.
 * Convention: `https://github.com/recoupable/<kebab(account_name)>-<account_id>`.
 *
 * Example: `recoupable/sweetman-fb678396-a68f-4294-ae50-b8cacf9ce77b`.
 *
 * Ported from open-agents `apps/web/lib/recoupable/build-personal-repo-url.ts`
 * — keep in lockstep with the chat-side helper and
 * `buildPersonalRepoIdentifier`.
 */
export function buildPersonalRepoUrl(params: { accountName: string; accountId: string }): string {
  const { owner, repo } = buildPersonalRepoIdentifier(params);
  return `https://github.com/${owner}/${repo}`;
}
