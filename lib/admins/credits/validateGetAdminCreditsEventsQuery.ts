import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { adminPeriodSchema } from "@/lib/admins/adminPeriod";

const getAdminCreditsEventsQuerySchema = z.object({
  account_id: z.string().uuid({ message: "account_id must be a valid UUID" }),
  period: adminPeriodSchema.default("monthly"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

export type ValidatedGetAdminCreditsEventsQuery = z.infer<typeof getAdminCreditsEventsQuerySchema>;

/**
 * Validates query parameters for `GET /api/admins/credits/events`.
 *
 * Returns a `NextResponse` with a 400 error on validation failure (missing or
 * malformed `account_id`, unknown `period`, out-of-range `limit`/`page`), or
 * the parsed `{ account_id, period, limit, page }` on success.
 */
export function validateGetAdminCreditsEventsQuery(
  request: NextRequest,
): NextResponse | ValidatedGetAdminCreditsEventsQuery {
  const params = request.nextUrl.searchParams;
  const result = getAdminCreditsEventsQuerySchema.safeParse({
    account_id: params.get("account_id") ?? undefined,
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
