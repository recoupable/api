import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { adminPeriodSchema } from "@/lib/admins/adminPeriod";
import type { NextRequest } from "next/server";

export const getSlackTagsQuerySchema = z.object({
  period: adminPeriodSchema.default("all"),
  tag: z.string().optional(),
});

export type GetSlackTagsQuery = z.infer<typeof getSlackTagsQuerySchema>;

/**
 * Validates the query parameters and admin auth for GET /api/admins/coding/slack.
 *
 * @param request - The incoming Next.js request
 * @returns A NextResponse on error, or { period, tag } on success
 */
export async function validateGetSlackTagsQuery(
  request: NextRequest,
): Promise<NextResponse | GetSlackTagsQuery> {
  const authResult = await validateAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const raw = {
    period: searchParams.get("period") ?? "all",
    tag: searchParams.get("tag") ?? undefined,
  };

  const result = getSlackTagsQuerySchema.safeParse(raw);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      { status: "error", error: firstError.message },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
