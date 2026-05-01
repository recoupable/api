import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { adminPeriodSchema } from "@/lib/admins/adminPeriod";
import type { NextRequest } from "next/server";

export const getContentSlackTagsQuerySchema = z.object({
  period: adminPeriodSchema.default("all"),
});

export type GetContentSlackTagsQuery = z.infer<typeof getContentSlackTagsQuerySchema>;

/**
 * Validates the query parameters and admin auth for GET /api/admins/content/slack.
 *
 * @param request - The incoming Next.js request
 * @returns A NextResponse on error, or { period } on success
 */
export async function validateGetContentSlackTagsQuery(
  request: NextRequest,
): Promise<NextResponse | GetContentSlackTagsQuery> {
  const authResult = await validateAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const raw = { period: searchParams.get("period") ?? "all" };

  const result = getContentSlackTagsQuerySchema.safeParse(raw);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
