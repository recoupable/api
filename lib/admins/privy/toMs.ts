/**
 * To Ms.
 *
 * @param timestamp - Value for timestamp.
 * @returns - Computed result.
 */
export function toMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}
