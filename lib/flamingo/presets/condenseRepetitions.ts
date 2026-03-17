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
export function condenseRepetitions(text: string, minRepeats: number = 3): string {
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
