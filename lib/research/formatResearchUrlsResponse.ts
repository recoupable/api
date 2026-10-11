import { isTrustedResearchUrl } from "@/lib/research/isTrustedResearchUrl";
import { isRecord } from "@/lib/research/songstats/isRecord";

export type ResearchUrlEntry = { domain: string; url: string };

/**
 * Formats normalized artist URL maps for `GET /api/research/urls`, dropping
 * entries that fail trust checks.
 */
export function formatResearchUrlsResponse(data: unknown): ResearchUrlEntry[] {
  if (!isRecord(data)) return [];

  return Object.entries(data)
    .filter((entry): entry is [string, string] => {
      const [, url] = entry;
      return typeof url === "string" && isTrustedResearchUrl(url);
    })
    .map(([domain, url]) => ({ domain, url }));
}
