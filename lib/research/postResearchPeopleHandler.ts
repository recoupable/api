import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { deductCredits } from "@/lib/credits/deductCredits";
import { searchPeople } from "@/lib/exa/searchPeople";
import { validatePostResearchPeopleRequest } from "@/lib/research/validatePostResearchPeopleRequest";

/**
 * POST /api/research/people
 *
 * Search for people in the music industry — artists, managers,
 * A&R reps, producers, etc. Uses multi-source people data
 * including LinkedIn profiles.
 *
 * @param request - Body: { query, num_results? }
 * @returns JSON success or error response
 */
export async function postResearchPeopleHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validatePostResearchPeopleRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await searchPeople(validated.query, validated.num_results ?? 10);

    try {
      await deductCredits({ accountId: validated.accountId, creditsToDeduct: 5 });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return successResponse({ results: result.results });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "People search failed", 500);
  }
}
