import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { buildAccountCreditsResponse } from "@/lib/credits/buildAccountCreditsResponse";
import { mapToAccountCreditsError } from "@/lib/credits/mapToAccountCreditsError";

/**
 * GET /api/accounts/[id]/credits
 *
 * Returns the documented credits resource for an account. Runs the monthly refill
 * check on read so the returned `remaining_credits` reflects any due top-up.
 */
export async function getAccountCreditsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const validated = await validateAccountCreditsParams(request, id);
    if (validated instanceof NextResponse) {
      return mapToAccountCreditsError(validated);
    }

    const { creditsUsage, isPro } = await checkAndResetCredits(validated);

    if (!creditsUsage) {
      return NextResponse.json(
        { error: "Account credits not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(buildAccountCreditsResponse({ creditsUsage, isPro }), {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[getAccountCreditsHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
