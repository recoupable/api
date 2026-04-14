/**
 * To Ms.
 *
 * @param timestamp - Parameter.
 * @returns - Result.
 */
export function toMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}
