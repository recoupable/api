import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import type { NextRequest } from "next/server";

export const slackTagsPeriodSchema = z.enum(["all", "daily", "weekly", "monthly"]).default("all");

export type SlackTagsPeriod = z.infer<typeof slackTagsPeriodSchema>;

export const getSlackTagsQuerySchema = z.object({
  period: slackTagsPeriodSchema,
});

export type GetSlackTagsQuery = z.infer<typeof getSlackTagsQuerySchema>;

/**
 * Validates the query parameters and admin auth for GET /api/admins/coding/slack.
 *
 * @param request - The incoming Next.js request
 * @returns A NextResponse on error, or { period } on success
 */
export async function validateGetSlackTagsQuery(
  request: NextRequest,
): Promise<NextResponse | GetSlackTagsQuery> {
  const authResult = await validateAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const raw = { period: searchParams.get("period") ?? "all" };

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
