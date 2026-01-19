const TEST_FRONTEND_URL = "https://test-recoup-chat.vercel.app";

/**
 * Get the frontend base URL based on environment.
 */
export function getFrontendBaseUrl(): string {
  if (process.env.VERCEL_ENV === "production") {
    return "https://chat.recoupable.com";
  }

  if (process.env.VERCEL_GIT_COMMIT_REF === "test") {
    return TEST_FRONTEND_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
