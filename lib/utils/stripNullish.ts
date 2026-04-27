/**
 * Returns a shallow copy of `row` with `null` and `undefined` fields
 * removed. Used before upserts so callers don't clobber existing
 * non-null column values just because they have nothing new to say
 * about those fields.
 */
export function stripNullish<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as T;
}
