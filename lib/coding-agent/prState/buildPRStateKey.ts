const KEY_PREFIX = "coding-agent:pr";

/**
 * Builds the Redis key for a given repo and branch.
 *
 * @param repo
 * @param branch
 */
export function buildPRStateKey(repo: string, branch: string): string {
  return `${KEY_PREFIX}:${repo}:${branch}`;
}
