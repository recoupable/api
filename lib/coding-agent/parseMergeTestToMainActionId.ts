/**
 * Parse Merge Test To Main Action Id.
 *
 * @param actionId - Parameter.
 * @returns - Result.
 */
export function parseMergeTestToMainActionId(actionId: string): string | null {
  const prefix = "merge_test_to_main:";
  if (!actionId.startsWith(prefix)) return null;
  const repo = actionId.slice(prefix.length);
  return repo.includes("/") ? repo : null;
}
