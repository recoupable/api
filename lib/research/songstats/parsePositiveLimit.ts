/**
 * Parses a positive integer limit from a string, or undefined when invalid.
 */
export function parsePositiveLimit(value?: string): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
