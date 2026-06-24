/**
 * Whether an api key's `expires_at` has passed. NULL/undefined = never expires.
 * An unparseable value is treated as non-expiring so a bad row can't lock a
 * caller out. Used by api auth to reject ephemeral keys past their TTL
 * (recoupable/chat#1813).
 */
export function isApiKeyExpired(
  expiresAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const exp = Date.parse(expiresAt);
  if (Number.isNaN(exp)) return false;
  return exp <= now;
}
