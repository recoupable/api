import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deductCredits } from "@/lib/credits/deductCredits";
import { extractUrl } from "@/lib/parallel/extractUrl";

const bodySchema = z.object({
  urls: z.array(z.string().min(1)).min(1).max(10),
  objective: z.string().optional(),
  full_content: z.boolean().optional(),
});

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
    const result = await extractUrl(body.urls, body.objective, body.full_content);

    try {
      await deductCredits({ accountId, creditsToDeduct: 5 * body.urls.length });
    } catch {
      // Credit deduction failed but data was fetched — log but don't block
    }

    return NextResponse.json(
      {
        status: "success",
        results: result.results,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Extract failed",
      },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
