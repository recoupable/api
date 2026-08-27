/**
 * Midnight UTC on the first of the month `now` falls in, as an ISO string.
 *
 * @param now - The reference instant.
 * @returns The month start.
 */
export function startOfCurrentUtcMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
