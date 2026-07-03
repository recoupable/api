const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Normalizes an email domain for organization domain mappings:
 * lowercased, trimmed, with a single leading "@" stripped.
 *
 * @param input - The raw domain input (e.g. " @SeekerMusic.COM ")
 * @returns The normalized bare domain (e.g. "seekermusic.com"), or null when
 *          the input is not a plausible bare domain (must contain at least
 *          one dot; no spaces, slashes, or "@").
 */
export function normalizeOrgDomain(input: string): string | null {
  const normalized = input.trim().toLowerCase().replace(/^@/, "");
  return DOMAIN_PATTERN.test(normalized) ? normalized : null;
}
