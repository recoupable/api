/**
 * Returns a shallow copy of `row` with `null` and `undefined` fields
 * removed. Used before upserts so callers don't clobber existing
 * non-null column values just because they have nothing new to say
 * about those fields.
 */
export function stripNullish<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(row) as [keyof T, T[keyof T]][]) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
