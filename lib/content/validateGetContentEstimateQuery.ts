import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const getContentEstimateQuerySchema = z.object({
  lipsync: z.coerce.boolean().default(false),
  batch: z.coerce.number().int().min(1).max(100).default(1),
  compare: z.coerce.boolean().default(false),
});

export type ValidatedGetContentEstimateQuery = z.infer<typeof getContentEstimateQuerySchema>;

/**
 * Validates auth and query params for GET /api/content/estimate.
 *
 * @param request
 */
export async function validateGetContentEstimateQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetContentEstimateQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const lipsync = request.nextUrl.searchParams.get("lipsync") ?? undefined;
  const batch = request.nextUrl.searchParams.get("batch") ?? undefined;
  const compare = request.nextUrl.searchParams.get("compare") ?? undefined;
  const result = getContentEstimateQuerySchema.safeParse({ lipsync, batch, compare });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
