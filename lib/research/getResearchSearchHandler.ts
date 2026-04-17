import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchSearchRequest } from "@/lib/research/validateGetResearchSearchRequest";

/**
 * GET /api/research/search
 *
 * Searches Chartmetric for artists, tracks, or albums by name.
 *
 * @param request - must include `q` query param
 * @returns JSON search results or error
 */
export async function getResearchSearchHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchSearchRequest(request);
    if (validated instanceof NextResponse) return validated;

    const query: Record<string, string> = {
      q: validated.q,
      type: validated.type,
      limit: validated.limit,
    };
    if (validated.beta !== undefined) query.beta = validated.beta;
    if (validated.platforms !== undefined) query.platforms = validated.platforms;
    if (validated.offset !== undefined) query.offset = validated.offset;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: "/search",
      query,
    });

    if ("error" in result) return errorResponse("Search failed", result.status);

    const data = result.data as {
      artists?: unknown[];
      tracks?: unknown[];
      albums?: unknown[];
      suggestions?: unknown[];
    };
    const results = data?.artists || data?.tracks || data?.albums || data?.suggestions || [];
    return successResponse({ results });
  } catch (error) {
    console.error("[ERROR] getResearchSearchHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
