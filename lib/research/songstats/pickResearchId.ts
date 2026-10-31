import type { JsonRecord } from "@/lib/research/songstats/isRecord";

/** Selects a usable opaque ID without coercing unrelated numeric metadata. */
export function pickResearchId(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}
