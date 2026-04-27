import { NEW_API_BASE_URL } from "@/lib/consts";

/**
 * Resolves the base URL Apify should POST its webhook to. Preview deploys
 * must report to themselves, not prod — otherwise preview runs pollute the
 * production DB via the shared webhook receiver.
 */
export function getReceiverBaseUrl(): string {
  if (process.env.VERCEL_ENV === "production") {
    return NEW_API_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
