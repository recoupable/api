/**
 * Converts an ISO-8601 timestamp string into epoch milliseconds.
 * Returns null for null / empty / unparseable input.
 *
 * @param value - The ISO timestamp from Supabase.
 * @returns Epoch milliseconds, or null when the value cannot be parsed.
 */
export function isoToEpochMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
