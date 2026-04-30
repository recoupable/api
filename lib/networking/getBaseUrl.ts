import { NEW_API_BASE_URL } from "@/lib/consts";

/**
 * Resolves the base URL for the current API server.
 * - Production: canonical `NEW_API_BASE_URL` so cross-deploy callbacks
 *   (Apify webhooks, etc.) always land on the stable prod alias.
 * - Preview: the deployment-specific `VERCEL_URL` so previews report
 *   to themselves and don't pollute prod.
 * - Local: `http://localhost:3000`. Note that third parties (Apify,
 *   etc.) cannot reach this — callers that need a public URL should
 *   guard against the localhost case.
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_ENV === "production") {
    return NEW_API_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
