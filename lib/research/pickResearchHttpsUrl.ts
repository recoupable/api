import { isResearchHttpsUrl } from "./isResearchHttpsUrl";
import type { JsonRecord } from "./songstats/isRecord";

export const RESEARCH_LINK_KEYS = ["url", "link", "href"] as const;

/** Returns the first link field satisfying the shared research URL rule. */
export function pickResearchHttpsUrl(record: JsonRecord): string | undefined {
  for (const key of RESEARCH_LINK_KEYS) {
    const value = record[key];
    if (typeof value === "string" && isResearchHttpsUrl(value)) return value;
  }
  return undefined;
}
