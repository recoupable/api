import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/** Private pilot responses use explicit token/API-key authentication, never credentialed CORS. */
export function getOriginalIntakeHeaders() {
  return {
    ...getCorsHeaders(),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "Retry-After",
    "Cache-Control": "private, no-store",
  };
}
