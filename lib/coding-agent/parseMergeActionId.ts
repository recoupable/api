/**
 * Parses a merge action ID like "merge_pr:recoupable/api#42"
 * into { repo, number } or null if the format doesn't match.
 *
 * @param actionId
 */
export function parseMergeActionId(actionId: string) {
  const match = actionId.match(/^merge_pr:(.+)#(\d+)$/);
  if (!match) return null;
  return { repo: match[1], number: parseInt(match[2], 10) };
}
