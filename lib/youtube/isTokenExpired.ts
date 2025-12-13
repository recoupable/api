/**
 * Checks if a YouTube token is expired or about to expire (within 1 minute safety buffer).
 *
 * @param expiresAt - The expiration timestamp (ISO string)
 * @returns True if token is expired or about to expire
 */
export function isTokenExpired(expiresAt: string): boolean {
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const oneMinuteInMs = 60 * 1000;
  return expirationTime <= now + oneMinuteInMs;
}

