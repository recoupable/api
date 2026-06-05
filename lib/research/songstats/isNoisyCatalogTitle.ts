const FEAT_PATTERN = /\b(feat\.?|featuring|ft\.?|with)\b/i;
const REMIX_PATTERN = /\b(remix|rmx|rework|demo|instrumental|live at)\b/i;

/**
 * Heuristic: titles that usually indicate a feature, remix, or non-canonical release.
 */
export function isNoisyCatalogTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;

  return FEAT_PATTERN.test(trimmed) || REMIX_PATTERN.test(trimmed);
}
