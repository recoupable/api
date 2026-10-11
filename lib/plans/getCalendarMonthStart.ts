/**
 * The first instant of the UTC calendar month `now` falls in, as an ISO
 * string, for the monthly plan counters (analyze cap, recoupable/app#2061).
 *
 * @param now - The reference time; defaults to the current time.
 * @returns e.g. `2026-09-01T00:00:00.000Z` for any moment in September 2026 UTC.
 */
export function getCalendarMonthStart(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
