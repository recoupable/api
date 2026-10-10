/**
 * Finds the index of the quote that would close a quoted CSV field, skipping doubled quotes.
 *
 * @param input - Full CSV text.
 * @param from - Index to start scanning from (inside the quoted field).
 * @returns The index of the closing quote, or -1 when nothing in the rest of the input closes it.
 */
export function findClosingQuote(input: string, from: number): number {
  let index = input.indexOf('"', from);
  while (index !== -1 && input[index + 1] === '"') index = input.indexOf('"', index + 2);
  return index;
}
