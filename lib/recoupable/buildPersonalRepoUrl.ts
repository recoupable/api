import { buildPersonalRepoIdentifier } from "./buildPersonalRepoIdentifier";

/**
 * Builds the GitHub URL for an account's Recoupable workspace repo.
 * Convention: `https://github.com/recoupable/<accountId>` — the
 * account UUID is the repo name with no slug prefix.
 *
 * Example: `https://github.com/recoupable/fb678396-a68f-4294-ae50-b8cacf9ce77b`.
 */
export function buildPersonalRepoUrl(params: { accountId: string }): string {
  const { owner, repo } = buildPersonalRepoIdentifier(params);
  return `https://github.com/${owner}/${repo}`;
}
