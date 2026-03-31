const KEY_PREFIX = "coding-agent:pr";

/**
 * Builds the Redis key for a given repo and branch.
 *
 * @param repo - Full repo identifier (e.g. "recoupable/api")
 * @param branch - Branch name (e.g. "agent/fix-bug")
 * @returns The Redis key string used to store and retrieve PR state
 */
export function buildPRStateKey(repo: string, branch: string): string {
  return `${KEY_PREFIX}:${repo}:${branch}`;
}
