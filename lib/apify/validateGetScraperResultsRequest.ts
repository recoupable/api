import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const getScraperResultsParamsSchema = z.object({
  runId: z.string().min(1),
});

export type GetScraperResultsParams = z.infer<typeof getScraperResultsParamsSchema>;

/**
 * Validates the runId path param and authenticates the request.
 */
export async function validateGetScraperResultsRequest(
  request: NextRequest,
  runId: string,
): Promise<GetScraperResultsParams | NextResponse> {
  const parsed = getScraperResultsParamsSchema.safeParse({ runId });
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

  return parsed.data;
}
