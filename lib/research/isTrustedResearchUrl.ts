/**
 * Returns true when `raw` is safe to expose as a clickable outbound link from
 * research endpoints (HTTPS only, no credentials, parseable host).
 */
export function isTrustedResearchUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;
  if (parsed.username || parsed.password) return false;

  return true;
}
