/**
 * Formats an integer cent amount as a USD string.
 *
 * @param cents - Amount in cents (e.g. 412).
 * @returns USD string (e.g. "$4.12").
 */
export function formatCentsAsUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
