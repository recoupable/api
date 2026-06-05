/**
 * Formats a token count compactly.
 *
 * @param n - Token count.
 * @returns Compact string (e.g. 1_240_000 -> "1.2M", 3400 -> "3.4K", 42 -> "42").
 */
export function formatCompactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
