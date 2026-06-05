import { isRecord, type JsonRecord } from "@/lib/research/songstats/isRecord";

/**
 * Returns the first record from a value, unwrapping a single-element array.
 */
export function firstRecord(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  return isRecord(value) ? value : null;
}
