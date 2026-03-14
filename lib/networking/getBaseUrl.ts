/**
 * Gets the base URL for the current API server.
 * Uses VERCEL_URL in Vercel deployments, falls back to localhost.
 *
 * @returns The base URL string
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
