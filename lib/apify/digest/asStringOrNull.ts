/** Coerces an unknown dataset value to a non-empty string, or null. */
export function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
