import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { adminPeriodSchema } from "@/lib/admins/adminPeriod";

const getAdminCreditsRollupQuerySchema = z.object({
  period: adminPeriodSchema.default("monthly"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

export type ValidatedGetAdminCreditsRollupQuery = z.infer<typeof getAdminCreditsRollupQuerySchema>;

/**
 * Validates query parameters for `GET /api/admins/credits/rollup`.
 *
 * Returns a `NextResponse` with a 400 error on validation failure, or the
 * parsed `{ period, limit, page }` on success. Auth is handled separately by
 * the route handler via `validateAdminAuth`.
 */
export function validateGetAdminCreditsRollupQuery(
  request: NextRequest,
): NextResponse | ValidatedGetAdminCreditsRollupQuery {
  const params = request.nextUrl.searchParams;
  const result = getAdminCreditsRollupQuerySchema.safeParse({
    period: params.get("period") ?? undefined,
    limit: params.get("limit") ?? undefined,
    page: params.get("page") ?? undefined,
  });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return result.data;
}
