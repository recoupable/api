import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { fetchBandsintownEvents } from "@/lib/apify/bandsintown/fetchBandsintownEvents";
import { validatePostResearchEventsRequest } from "@/lib/research/validatePostResearchEventsRequest";

/**
 * Artist events handler — returns an artist's live shows from Bandsintown,
 * keyed on the artist's numeric id so results cannot drift to a same-named
 * performer.
 *
 * An artist with no matching events is a success with an empty array, not a
 * 404: "this artist is not touring" is a valid answer to the question asked.
 *
 * @param request - JSON body with `bandsintown_id` and optional `date`
 * @returns JSON `{ status, events }`, or an error response
 */
export async function postResearchEventsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validatePostResearchEventsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const events = await fetchBandsintownEvents({
      bandsintownId: validated.bandsintown_id,
      ...(validated.date && { date: validated.date }),
    });

    try {
      await recordCreditDeduction({
        accountId: validated.accountId,
        creditsToDeduct: 1,
        source: "api",
      });
    } catch {
      // Credit deduction failed but data was fetched — don't block the response
    }

    return successResponse({ events });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Artist events lookup failed",
      500,
    );
  }
}
