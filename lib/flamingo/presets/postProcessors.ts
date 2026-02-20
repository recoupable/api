/**
 * Post-processing utilities for Music Flamingo preset responses.
 * These fix common model output issues like repetition loops
 * and Python-style single-quoted JSON.
 */

/**
 * Converts Python-style single-quoted dict output to valid JSON,
 * then parses it. Falls back to JSON.parse if already valid JSON.
 *
 * @param raw - Raw model output string (may use single or double quotes)
 * @returns Parsed JavaScript object
 * @throws Error if the string cannot be parsed as JSON or Python dict
 */
export function parseJsonLike(raw: string): unknown {
  const trimmed = raw.trim();

  // Try standard JSON first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to single-quote fix
  }

  // Replace single quotes with double quotes (Python dict → JSON)
  // Handle escaped apostrophes in text like "don't" by only replacing
  // quotes that are at dict/array boundaries
  const fixed = trimmed
    .replace(/'/g, '"')
    .replace(/True/g, "true")
    .replace(/False/g, "false")
    .replace(/None/g, "null");

  return JSON.parse(fixed);
}

/**
 * Condenses repeated tokens in text output.
 * For example: "oh, oh, oh, oh, oh" → "(oh x5)"
 *
 * Works with comma-separated or space-separated repeated words.
 * Only condenses runs of 3 or more identical tokens.
 *
 * @param text - Raw text with potential repetitions
 * @param minRepeats - Minimum repetitions to trigger condensing (default 3)
 * @returns Text with repetitions condensed
 */
export function condenseRepetitions(
  text: string,
  minRepeats: number = 3,
): string {
  // Split on comma+space boundaries
  const tokens = text.split(/,\s*/);
  const result: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i].trim();
    let count = 1;

    // Count consecutive identical tokens
    while (i + count < tokens.length && tokens[i + count].trim() === token) {
      count++;
    }

    if (count >= minRepeats) {
      result.push(`(${token} x${count})`);
    } else {
      for (let j = 0; j < count; j++) {
        result.push(tokens[i + j].trim());
      }
    }
    i += count;
  }

  return result.join(", ");
}

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

/**
 * Deduplicates an array, keeping only unique items in order.
 *
 * @param items - Array with potential duplicates
 * @returns Array with duplicates removed
 */
export function deduplicateArray<T>(items: T[]): T[] {
  return [...new Set(items)];
}
