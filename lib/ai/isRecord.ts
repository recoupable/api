/**
 * Type guard for "plain object" values: anything that is not null,
 * not a primitive, and not an array. Used by tolerant parsers that
 * walk an `unknown` payload (e.g. a third-party metadata catalog)
 * without ever throwing on shape mismatches.
 *
 * @param value - Candidate to test.
 * @returns `true` if `value` is a non-null, non-array object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
