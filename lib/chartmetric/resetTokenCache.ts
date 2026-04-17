import { chartmetricTokenCache } from "./chartmetricTokenCache";

/**
 * Reset the cached Chartmetric access token. Test-only utility — lets tests
 * observe the fetch path without carrying state across cases.
 *
 * @internal
 */
export function resetTokenCache(): void {
  chartmetricTokenCache.token = null;
  chartmetricTokenCache.expiresAt = 0;
}
