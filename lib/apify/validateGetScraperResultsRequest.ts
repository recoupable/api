import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const getScraperResultsParamsSchema = {
  runId: z.string().min(1).describe("The Apify run identifier from the URL path."),
};

export type GetScraperResultsParams = z.infer<z.ZodObject<typeof getScraperResultsParamsSchema>>;

/**
 * Validates the path segment and authentication for GET /api/apify/runs/{runId}.
 *
 * Authentication is required (via `validateAuthContext`) but there is
 * deliberately no per-account access check layered on top. A `runId` is an
 * Apify-scoped identifier, not a user- or account-scoped resource — there is
 * no foreign-key relationship from an Apify run back to an account/artist in
 * our database, so an access-check would have nothing to check against.
 * Future maintainers: the absence of a `check*Access` call here is not an
 * oversight. If we ever persist `runId → account_id` ownership (e.g. via the
 * socials-scrape table) this should be revisited.
 *
 * @param request - The incoming request.
 * @param runId - The Apify run ID taken from the URL path segment.
 * @returns The validated `{ runId }` payload or a `NextResponse` error.
 */
export async function validateGetScraperResultsRequest(
  request: NextRequest,
  runId: string,
): Promise<GetScraperResultsParams | NextResponse> {
  const parsed = z.object(getScraperResultsParamsSchema).safeParse({ runId });
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: "Missing or invalid runId parameter" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  return { runId: parsed.data.runId };
}

export default validateGetScraperResultsRequest;
