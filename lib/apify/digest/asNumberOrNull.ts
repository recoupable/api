/** Coerces an unknown dataset value to a finite number, or null. */
export function asNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}
