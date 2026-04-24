import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

export const getScraperResultsParamsSchema = z.object({
  runId: z.string().min(1),
});

export type GetScraperResultsParams = z.infer<typeof getScraperResultsParamsSchema>;

/**
 * Authenticates the request as an admin, then validates the runId path param.
 *
 * Admin-only: Apify run identifiers are not account-scoped, and the poller
 * is a backend-only caller (tasks).
 */
export async function validateGetScraperResultsRequest(
  request: NextRequest,
  runId: string,
): Promise<GetScraperResultsParams | NextResponse> {
  const authResult = await validateAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const parsed = getScraperResultsParamsSchema.safeParse({ runId });
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", error: "Missing or invalid runId parameter" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return parsed.data;
}
