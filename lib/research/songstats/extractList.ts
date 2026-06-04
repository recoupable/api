import { isRecord } from "@/lib/research/songstats/isRecord";

/**
 * Extracts the first array found at the given keys, searching nested records.
 */
export function extractList(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  for (const key of keys) {
    const child = value[key];
    if (Array.isArray(child)) return child;
    if (isRecord(child)) {
      const nested = extractList(child, keys);
      if (nested.length) return nested;
    }
  }

  return [];
}
