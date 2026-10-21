import { isResearchHttpsUrl } from "./isResearchHttpsUrl";
import { isRecord } from "./songstats/isRecord";

type ResearchUrlEntry = { domain: string; url: string };

/** Filters map and legacy array responses into the documented link-entry shape. */
export function formatResearchUrlsResponse(data: unknown): ResearchUrlEntry[] {
  const entries = Array.isArray(data)
    ? data
    : isRecord(data)
      ? Object.entries(data).map(([domain, url]) => ({ domain, url }))
      : [];
  return entries.flatMap(entry =>
    isRecord(entry) &&
    typeof entry.domain === "string" &&
    typeof entry.url === "string" &&
    isResearchHttpsUrl(entry.url)
      ? [{ domain: entry.domain, url: entry.url }]
      : [],
  );
}
