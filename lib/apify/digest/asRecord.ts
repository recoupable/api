/** Coerces an unknown dataset value to a record, or an empty one. */
export function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
