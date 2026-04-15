import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { deductCredits } from "@/lib/credits/deductCredits";
import { enrichEntity } from "@/lib/parallel/enrichEntity";
import { validatePostResearchEnrichRequest } from "@/lib/research/validatePostResearchEnrichRequest";

/**
 * POST /api/research/enrich
 *
 * Enrich an entity with structured data from web research.
 * Provide a description of who/what to research and a JSON schema
 * defining what fields to extract. Returns typed data with citations.
 *
 * @param request - Body: { input, schema, processor? }
 * @returns JSON success or error response
 */
export async function postResearchEnrichHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validatePostResearchEnrichRequest(request);
    if (validated instanceof NextResponse) return validated;

    const creditCost =
      validated.processor === "ultra" ? 25 : validated.processor === "core" ? 10 : 5;

    const result = await enrichEntity(validated.input, validated.schema, validated.processor);

    if (result.status === "timeout") {
      return NextResponse.json(
        {
          status: "error",
          error: "Enrichment timed out. Try a simpler schema or use processor: 'base'.",
          run_id: result.run_id,
        },
        { status: 504, headers: getCorsHeaders() },
      );
    }

    try {
      await deductCredits({ accountId: validated.accountId, creditsToDeduct: creditCost });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return successResponse({
      output: result.output,
      citations: result.citations,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Enrichment failed", 500);
  }
}
