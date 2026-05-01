import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { chatWithPerplexity } from "@/lib/perplexity/chatWithPerplexity";

const bodySchema = z.object({
  query: z.string().min(1, "query is required"),
});

/**
 * Deep research handler — performs comprehensive research via Perplexity sonar-deep-research with citations.
 *
 * @param request - JSON body with `query` string
 * @returns JSON research report with citations or error
 */
export async function postResearchDeepHandler(request: NextRequest): Promise<NextResponse> {
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
    const result = await chatWithPerplexity(
      [{ role: "user", content: body.query }],
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
