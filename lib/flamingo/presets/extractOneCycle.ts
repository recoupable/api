/**
 * Extracts a single cycle from a repeating array.
 * For example: ["C","G","Am","F","C","G","Am","F"] → ["C","G","Am","F"]
 *
 * Finds the shortest repeating pattern by checking if the array
 * is composed of repeated copies of its prefix.
 *
 * @param items - Array with potential repeating pattern
 * @returns The shortest repeating cycle, or the original array if no pattern found
 */
export function extractOneCycle<T>(items: T[]): T[] {
  if (items.length <= 1) return items;

  for (let cycleLen = 2; cycleLen <= items.length / 2; cycleLen++) {
    const cycle = items.slice(0, cycleLen);
    let matches = true;

    for (let i = cycleLen; i < items.length; i++) {
      if (items[i] !== cycle[i % cycleLen]) {
        matches = false;
        break;
      }
    }

    if (matches) return cycle;
  }

  return items;
}

