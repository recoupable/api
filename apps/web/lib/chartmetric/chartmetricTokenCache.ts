/**
 * Shared in-memory cache for the short-lived Chartmetric access token.
 *
 * Isolated in its own module so both `getChartmetricToken` (writer/reader) and
 * `resetTokenCache` (test-only clear) can share state without either file
 * owning both responsibilities.
 */
export const chartmetricTokenCache: {
  token: string | null;
  expiresAt: number;
} = {
  token: null,
  expiresAt: 0,
};
