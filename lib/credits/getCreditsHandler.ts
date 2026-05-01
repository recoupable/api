import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { validateCreditsGetQuery } from "@/lib/credits/validateCreditsGetQuery";

/**
 * Handles GET /api/credits/get — returns the credits row for the given
 * account, refilling it when the account is on a refill cycle.
 */
export async function getCreditsHandler(request: NextRequest): Promise<NextResponse> {
  const validated = validateCreditsGetQuery(request.nextUrl.searchParams);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const creditsUsage = await checkAndResetCredits(validated.accountId);
    return NextResponse.json({ data: creditsUsage }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("/api/credits/get error", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
