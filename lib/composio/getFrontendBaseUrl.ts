/**
 * Get the base URL for the frontend based on environment.
 *
 * Why: Different environments (production vs local) need different URLs
 * for OAuth callbacks and other frontend redirects.
 *
 * @returns The frontend base URL (e.g., "https://chat.recoupable.com" or "http://localhost:3001")
 */
export function getFrontendBaseUrl(): string {
  const isProd = process.env.VERCEL_ENV === "production";
  return isProd ? "https://chat.recoupable.com" : "http://localhost:3001";
}
