import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import type { NextRequest } from "next/server";

export const getCodingPrQuerySchema = z.object({
  pull_requests: z
    .array(z.string().url("Each pull_request must be a valid URL"))
    .min(1, "pull_requests must have at least one URL"),
});

export type GetCodingPrQuery = z.infer<typeof getCodingPrQuerySchema>;

/**
 * Validates the query parameters and admin auth for GET /api/admins/coding/pr.
 *
 * @param request - The incoming Next.js request
 * @returns A NextResponse on error, or { pull_requests } on success
 */
export async function validateGetCodingPrQuery(
  request: NextRequest,
): Promise<NextResponse | GetCodingPrQuery> {
  const authResult = await validateAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const raw = { pull_requests: searchParams.getAll("pull_requests") };

  const result = getCodingPrQuerySchema.safeParse(raw);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
