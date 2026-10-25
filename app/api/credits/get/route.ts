import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCreditsUsageHandler } from "@/lib/credits/getCreditsUsageHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Returns the standard CORS preflight without loading account or credits data.
 * @returns An uncached 200 response with CORS headers
 */
export function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...getCorsHeaders(), "Cache-Control": "no-store" },
  });
}

/**
 * GET /api/credits/get?accountId=<uuid>
 *
 * Authenticated compatibility read of the raw credits_usage row as { data }.
 * Missing rows return null; this route never seeds, refills or enriches credits.
 * Existing account/organization access rules apply. Privy users must already be
 * onboarded; identity verification may read Privy but never creates an account.
 *
 * @param request - Request with exactly one accountId UUID and one auth mechanism
 * @returns Uncached stored data or a standard validation/authentication/read error
 */
export async function GET(request: NextRequest) {
  return getCreditsUsageHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
