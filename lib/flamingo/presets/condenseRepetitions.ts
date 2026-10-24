/**
 * Condenses consecutive identical comma-separated tokens in text output.
 * For example: "oh, oh, oh, oh, oh" → "(oh x5)"
 *
 * Splits on commas and trims each token before case-sensitive comparison.
 * Spaces and line breaks alone do not separate tokens; multi-word tokens are
 * compared as a whole. Runs condense when their count reaches minRepeats
 * (default 3). Empty tokens are not filtered out.
 *
 * Joins all output tokens with ", ", including runs that are not condensed,
 * so surrounding token whitespace and comma spacing may be normalized.
 *
 * @param text - Raw text with potential repetitions
 * @param minRepeats - Minimum repetitions to trigger condensing (default 3)
 * @returns Text with repetitions condensed
 */
export function condenseRepetitions(text: string, minRepeats: number = 3): string {
  // Split on commas followed by optional whitespace, not on whitespace alone.
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
