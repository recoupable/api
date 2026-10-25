import { NextRequest, NextResponse } from "next/server";
import { validateGetCreditsUsageQuery } from "@/lib/credits/validateGetCreditsUsageQuery";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import {
  selectCreditsUsage,
  type CreditsUsage,
} from "@/lib/supabase/credits_usage/selectCreditsUsage";

/**
 * Reads the raw stored credits row without seeding, refilling or enriching it.
 *
 * @param request - Authenticated compatibility credits GET request
 * @returns The stored row or null under data, or a typed validation/auth/read error
 */
export async function getCreditsUsageHandler(request: NextRequest): Promise<NextResponse> {
  let response: NextResponse;
  try {
    const accountId = await validateGetCreditsUsageQuery(request);
    if (accountId instanceof NextResponse) {
      response = accountId;
    } else {
      const rows = await selectCreditsUsage({ account_id: accountId });
      response = NextResponse.json<{ data: CreditsUsage | null }>(
        { data: rows[0] ?? null },
        { headers: getCorsHeaders() },
      );
    }
  } catch {
    response = errorResponse("Failed to load credits usage", 500);
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}
