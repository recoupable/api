/**
 * Converts a Date, string, null, or undefined value to an ISO 8601 string or null.
 */
export function toISOStringOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}
