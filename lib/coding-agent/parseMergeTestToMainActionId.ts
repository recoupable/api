/**
 * Parses a merge_test_to_main action ID like "merge_test_to_main:recoupable/api"
 * into the repo string, or null if the format doesn't match.
 *
 * @param actionId - The action ID string from a merge-test-to-main button click (e.g. "merge_test_to_main:recoupable/api")
 * @returns The repo string (e.g. "recoupable/api"), or null if the actionId format is invalid
 */
export function parseMergeTestToMainActionId(actionId: string): string | null {
  const prefix = "merge_test_to_main:";
  if (!actionId.startsWith(prefix)) return null;
  const repo = actionId.slice(prefix.length);
  return repo.includes("/") ? repo : null;
}
