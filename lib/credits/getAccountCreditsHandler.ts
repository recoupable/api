import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { buildAccountCreditsResponse } from "@/lib/credits/buildAccountCreditsResponse";
import { mapToAccountCreditsError } from "@/lib/credits/mapToAccountCreditsError";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";

/**
 * GET /api/accounts/[id]/credits
 *
 * Returns the documented credits resource for an account. Runs the monthly refill
 * check on read so the returned `remaining_credits` reflects any due top-up. An
 * account with no credits row yet (an org that has never spent) gets one seeded
 * with its plan's allotment, the same way account creation and auto top-up do.
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

    const reset = await checkAndResetCredits(validated);
    const { plan } = reset;
    // Two first reads can race: if this insert loses, the winner's row is read back.
    const creditsUsage =
      reset.creditsUsage ??
      (await initializeAccountCredits(validated, plan)) ??
      (await selectCreditsUsage({ account_id: validated }))[0] ??
      null;

    if (!creditsUsage) {
      return NextResponse.json(
        { error: "Account credits not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }

    return NextResponse.json(buildAccountCreditsResponse({ creditsUsage, plan }), {
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
