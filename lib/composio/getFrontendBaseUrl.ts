/**
 * Get the base URL for the frontend based on environment.
 *
 * Why: Different environments (production, preview, local) need different URLs
 * for OAuth callbacks and other frontend redirects.
 *
 * - Production: Uses the canonical chat.recoupable.com domain
 * - Preview (Vercel): Uses VERCEL_URL for the deployment-specific URL
 * - Local: Falls back to localhost:3001
 *
 * @returns The frontend base URL (e.g., "https://chat.recoupable.com")
 */
export function getFrontendBaseUrl(): string {
  // Production environment
  if (process.env.VERCEL_ENV === "production") {
    return "https://chat.recoupable.com";
  }

  // Vercel preview deployments - use the deployment URL
  // VERCEL_URL doesn't include protocol, so we prepend https://
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development fallback
  return "http://localhost:3001";
}
