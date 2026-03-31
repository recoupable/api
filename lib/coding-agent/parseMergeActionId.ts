/**
 * Parses a merge action ID like "merge_pr:recoupable/api#42"
 * into { repo, number } or null if the format doesn't match.
 *
 * @param actionId - The action ID string from a merge button click (e.g. "merge_pr:recoupable/api#42")
 * @returns An object with repo and number fields, or null if the actionId format is invalid
 */
export function parseMergeActionId(actionId: string) {
  const match = actionId.match(/^merge_pr:(.+)#(\d+)$/);
  if (!match) return null;
  return { repo: match[1], number: parseInt(match[2], 10) };
}
