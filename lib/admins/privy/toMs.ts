/**
 * Normalizes a Privy timestamp to milliseconds.
 * Privy docs say milliseconds but examples show seconds (10 digits).
 *
 * @param timestamp
 */
export function toMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}
