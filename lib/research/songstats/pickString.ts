import type { JsonRecord } from "@/lib/research/songstats/isRecord";

/**
 * Returns the first key's value coerced to a string, or undefined.
 */
export function pickString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }

  return undefined;
}
