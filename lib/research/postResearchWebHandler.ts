import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { searchPerplexity } from "@/lib/perplexity/searchPerplexity";
import { formatSearchResultsAsMarkdown } from "@/lib/perplexity/formatSearchResultsAsMarkdown";

const bodySchema = z.object({
  query: z.string().min(1, "query is required"),
  max_results: z.coerce.number().int().min(1).max(20).optional(),
  country: z.string().length(2).optional(),
});

/**
 * Web search handler — queries Perplexity for real-time web results with formatted markdown output.
 *
 * @param request - JSON body with `query`, optional `max_results` and `country`
 * @returns JSON search results with formatted markdown or error
 */
export async function postResearchWebHandler(request: NextRequest): Promise<NextResponse> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request body";
    return NextResponse.json(
      { status: "error", error: message ?? "Invalid request body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  try {
    const searchResponse = await searchPerplexity({
      query: body.query,
      max_results: body.max_results ?? 10,
      max_tokens_per_page: 1024,
      ...(body.country && { country: body.country }),
    });

    const formatted = formatSearchResultsAsMarkdown(searchResponse);

    try {
      await deductCredits({ accountId, creditsToDeduct: 5 });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return NextResponse.json(
      {
        status: "success",
        results: searchResponse.results,
        formatted,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Web search failed",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
