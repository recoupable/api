import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildInsufficientCreditsResponse } from "@/lib/credits/buildInsufficientCreditsResponse";
import { getPostStats } from "@/lib/publishing/stats/getPostStats";

/**
 * GET /api/posts/{id}/stats
 *
 * A published post's own platform numbers, read live through the connection
 * that published it. LinkedIn company-page posts only; other platforms and
 * member posts answer 422. A read costs $0.001: credits are checked (402)
 * before LinkedIn is called and charged only after a successful read. Uuid, auth and access checks
 * match getPostHandler. The read itself is shared with the
 * `get_published_post_stats` MCP tool through getPostStats.
 *
 * @param request - The incoming request.
 * @param id - Post id from the route segment.
 * @returns `{ status, stats }`.
 */
export async function getPostStatsHandler(request: NextRequest, id: string): Promise<NextResponse> {
  if (!z.string().uuid().safeParse(id).success) {
    return errorResponse("id must be a valid UUID", 400);
  }

  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const result = await getPostStats({ accountId: authResult.accountId, postId: id });
    if (result.kind === "rejected") return errorResponse(result.message, result.status);
    if (result.kind === "insufficient_credits") {
      return NextResponse.json(buildInsufficientCreditsResponse(result), {
        status: 402,
        headers: getCorsHeaders(),
      });
    }
    return successResponse({ stats: result.stats });
  } catch (error) {
    console.error("Error fetching post stats:", error);
    return errorResponse("Internal server error", 500);
  }
}
