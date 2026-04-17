import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { deductCredits } from "@/lib/credits/deductCredits";
import { extractUrl } from "@/lib/parallel/extractUrl";
import { validatePostResearchExtractRequest } from "@/lib/research/validatePostResearchExtractRequest";

/**
 * POST /api/research/extract
 *
 * Extract clean markdown content from one or more URLs.
 * Handles JavaScript-heavy pages and PDFs.
 *
 * @param request - Body: { urls, objective?, full_content? }
 * @returns JSON success or error response
 */
export async function postResearchExtractHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validatePostResearchExtractRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await extractUrl(validated.urls, validated.objective, validated.full_content);

    try {
      await deductCredits({
        accountId: validated.accountId,
        creditsToDeduct: 5 * validated.urls.length,
      });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return successResponse({
      results: result.results,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Extract failed", 500);
  }
}
