/**
 * Frontend base URL for the test environment.
 * Set this to your test Recoup-Chat deployment domain.
 */
const TEST_FRONTEND_URL = "https://recoup-chat-git-test-recoupable.vercel.app";

/**
 * Get the base URL for the frontend based on environment.
 *
 * Why: Different environments (production, test, preview, local) need different URLs
 * for OAuth callbacks and other frontend redirects.
 *
 * - Production: Uses the canonical chat.recoupable.com domain
 * - Test branch: Uses the test frontend deployment
 * - Preview (Vercel): Uses VERCEL_URL for deployment-specific URL
 * - Local: Falls back to localhost:3001
 *
 * @returns The frontend base URL (e.g., "https://chat.recoupable.com")
 */
export function getFrontendBaseUrl(): string {
  // Production environment
  if (process.env.VERCEL_ENV === "production") {
    return "https://chat.recoupable.com";
  }

  // Test branch deployment - uses stable test frontend
  // VERCEL_GIT_COMMIT_REF contains the branch name on Vercel
  if (process.env.VERCEL_GIT_COMMIT_REF === "test") {
    return TEST_FRONTEND_URL;
  }

  // Vercel preview deployments - use the deployment URL
  // VERCEL_URL doesn't include protocol, so we prepend https://
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local development fallback
  return "http://localhost:3001";
}
