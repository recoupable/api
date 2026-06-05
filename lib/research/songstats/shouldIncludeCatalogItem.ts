import { isNoisyCatalogTitle } from "@/lib/research/songstats/isNoisyCatalogTitle";
import { isRecord } from "@/lib/research/songstats/isRecord";
import { pickString } from "@/lib/research/songstats/pickString";

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

function isSecondaryRole(role: unknown): boolean {
  if (typeof role !== "string") return false;
  const normalized = role.toLowerCase();
  return (
    normalized.includes("feature") ||
    normalized.includes("remix") ||
    normalized.includes("guest") ||
    normalized === "secondary"
  );
}

/**
 * When `includeNonPrimary` is false, drops remix/feature appearances and other noisy catalog rows.
 */
export function shouldIncludeCatalogItem(value: unknown, includeNonPrimary: boolean): boolean {
  if (includeNonPrimary) return isRecord(value);
  if (!isRecord(value)) return false;

  if (
    isTruthyFlag(value.is_remix) ||
    isTruthyFlag(value.is_feature) ||
    isTruthyFlag(value.is_secondary)
  ) {
    return false;
  }

  const title = pickString(value, ["title", "name", "track_title"]);
  const trackId = pickString(value, ["songstats_track_id", "track_id"]);
  if (!title && !trackId) return false;
  if (title && isNoisyCatalogTitle(title)) return false;

  const role = value.role ?? value.artist_role ?? value.credit_role;
  if (isSecondaryRole(role)) return false;

  return true;
}
