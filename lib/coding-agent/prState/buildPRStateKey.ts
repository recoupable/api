const KEY_PREFIX = "coding-agent:pr";

/**
 * Build PRState Key.
 *
 * @param repo - Value for repo.
 * @param branch - Value for branch.
 * @returns - Computed result.
 */
export function buildPRStateKey(repo: string, branch: string): string {
  return `${KEY_PREFIX}:${repo}:${branch}`;
}
