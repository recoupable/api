import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { validateGetCreditsRequest } from "@/lib/credits/validateGetCreditsRequest";

/**
 * Handles GET /api/credits — returns the credits row for the
 * authenticated account, refilling it when the account is on a refill
 * cycle.
 */
export async function getCreditsHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateGetCreditsRequest(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  try {
    const creditsUsage = await checkAndResetCredits(validated.accountId);
    return NextResponse.json({ data: creditsUsage }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("/api/credits error", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
