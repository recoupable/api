/**
 * Deduplicates an array, keeping only unique items in order.
 *
 * @param items - Array with potential duplicates
 * @returns Array with duplicates removed
 */
export function deduplicateArray<T>(items: T[]): T[] {
  return [...new Set(items)];
}
