import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deductCredits } from "@/lib/credits/deductCredits";
import { validatePostResearchDeepRequest } from "@/lib/research/validatePostResearchDeepRequest";
import { chatWithPerplexity } from "@/lib/perplexity/chatWithPerplexity";

/**
 * Deep research handler — performs comprehensive research via Perplexity sonar-deep-research with citations.
 *
 * @param request - JSON body with `query` string
 * @returns JSON research report with citations or error
 */
export async function postResearchDeepHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validatePostResearchDeepRequest(request);
  if (validated instanceof NextResponse) return validated;
  const { accountId, query } = validated;

  try {
    const result = await chatWithPerplexity(
      [{ role: "user", content: query }],
      "sonar-deep-research",
    );

    try {
      await deductCredits({ accountId, creditsToDeduct: 25 });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return NextResponse.json(
      {
        status: "success",
        content: result.content,
        citations: result.citations,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Deep research failed",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
