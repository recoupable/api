import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { deductCredits } from "@/lib/credits/deductCredits";
import { searchPerplexity } from "@/lib/perplexity/searchPerplexity";
import { formatSearchResultsAsMarkdown } from "@/lib/perplexity/formatSearchResultsAsMarkdown";
import { validatePostResearchWebRequest } from "@/lib/research/validatePostResearchWebRequest";

/**
 * Web search handler — queries Perplexity for real-time web results with formatted markdown output.
 *
 * @param request - JSON body with `query`, optional `max_results` and `country`
 * @returns JSON search results with formatted markdown or error
 */
export async function postResearchWebHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validatePostResearchWebRequest(request);
    if (validated instanceof NextResponse) return validated;

    const searchResponse = await searchPerplexity({
      query: validated.query,
      max_results: validated.max_results ?? 10,
      max_tokens_per_page: 1024,
      ...(validated.country && { country: validated.country }),
    });

    const formatted = formatSearchResultsAsMarkdown(searchResponse);

    try {
      await deductCredits({ accountId: validated.accountId, creditsToDeduct: 5 });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return successResponse({
      results: searchResponse.results,
      formatted,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Web search failed", 500);
  }
}
