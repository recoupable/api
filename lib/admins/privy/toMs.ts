/**
 * Normalizes a Privy timestamp to milliseconds.
 * Privy docs say milliseconds but examples show seconds (10 digits).
 *
 * @param timestamp - A Privy timestamp that may be in either seconds or milliseconds.
 * @returns The timestamp normalized to milliseconds.
 */
export function toMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}
