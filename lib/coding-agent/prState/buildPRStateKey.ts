const KEY_PREFIX = "coding-agent:pr";

/**
 * Build PRState Key.
 *
 * @param repo - Parameter.
 * @param branch - Parameter.
 * @returns - Result.
 */
export function buildPRStateKey(repo: string, branch: string): string {
  return `${KEY_PREFIX}:${repo}:${branch}`;
}
