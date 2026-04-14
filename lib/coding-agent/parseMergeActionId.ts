/**
 * Parse Merge Action Id.
 *
 * @param actionId - Value for actionId.
 * @returns - Computed result.
 */
export function parseMergeActionId(actionId: string) {
  const match = actionId.match(/^merge_pr:(.+)#(\d+)$/);
  if (!match) return null;
  return { repo: match[1], number: parseInt(match[2], 10) };
}
