import { isTrustedResearchUrl } from "@/lib/research/isTrustedResearchUrl";
import type { JsonRecord } from "@/lib/research/songstats/isRecord";

export const RESEARCH_LINK_KEYS = ["url", "link", "href"] as const;

/**
 * Returns the first trusted https URL among the given keys on `record`.
 */
export function pickTrustedResearchUrl(
  record: JsonRecord,
  keys: readonly string[] = RESEARCH_LINK_KEYS,
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && isTrustedResearchUrl(value)) return value;
  }

  return undefined;
}
