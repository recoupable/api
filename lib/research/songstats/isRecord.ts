export type JsonRecord = Record<string, unknown>;

/**
 * Type guard for a plain (non-array) object record.
 */
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
