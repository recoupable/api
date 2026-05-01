import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";

/**
 * Handles GET /api/credits — returns the credits row for the
 * authenticated account, refilling it when the account is on a refill
 * cycle.
 */
export async function getCreditsHandler(request: NextRequest): Promise<NextResponse> {
  const authContext = await validateAuthContext(request, {});
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    const creditsUsage = await checkAndResetCredits(authContext.accountId);
    return NextResponse.json({ data: creditsUsage }, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("/api/credits error", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
