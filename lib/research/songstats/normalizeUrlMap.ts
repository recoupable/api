import { isTrustedResearchUrl } from "@/lib/research/isTrustedResearchUrl";
import { isRecord, type JsonRecord } from "@/lib/research/songstats/isRecord";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Walks a value and collects platform-keyed URLs into a flat map.
 */
export function normalizeUrlMap(value: unknown): JsonRecord {
  const urls: JsonRecord = {};

  const visit = (current: unknown, keyHint?: string): void => {
    if (typeof current === "string") {
      if (isTrustedResearchUrl(current)) urls[keyHint || current] = current;
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) visit(item, keyHint);
      return;
    }

    if (!isRecord(current)) return;

    const platform = pickString(current, ["platform", "source", "type", "name", "domain"]);
    const url = pickString(current, ["url", "link", "href"]);
    if (url && isTrustedResearchUrl(url)) {
      urls[platform || url] = url;
    }

    for (const [key, child] of Object.entries(current)) {
      if (url && (key === "url" || key === "link" || key === "href")) continue;
      visit(child, key);
    }
  };

  visit(value);
  return urls;
}
