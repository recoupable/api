import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

const iso = z.string().datetime({ offset: true });

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: iso.optional(),
  from: iso.optional(),
  to: iso.optional(),
});

export interface GetAccountUsageQuery {
  limit: number;
  /** `created_at` of the last item on the previous page; items strictly older are returned. */
  cursor: string | undefined;
  /** Inclusive lower bound on `created_at`, ISO 8601 UTC. */
  from: string;
  /** Exclusive upper bound on `created_at`, ISO 8601 UTC. */
  to: string;
}

function startOfCurrentUtcMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Validates the query string of `GET /api/accounts/{id}/usage`.
 *
 * Defaults: `limit` 20, `from` the start of the current UTC month, `to` now.
 * Timestamps are normalised to UTC ISO strings so the response `period` and
 * the database filters carry one representation.
 *
 * @returns The validated query, or a 400 NextResponse with `{ error }`.
 */
export function validateGetAccountUsageQuery(
  request: NextRequest,
): GetAccountUsageQuery | NextResponse {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const now = new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from).toISOString()
    : startOfCurrentUtcMonth(now);
  const to = parsed.data.to ? new Date(parsed.data.to).toISOString() : now.toISOString();
  if (from >= to) {
    return NextResponse.json(
      { error: "from must be earlier than to" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    limit: parsed.data.limit,
    cursor: parsed.data.cursor ? new Date(parsed.data.cursor).toISOString() : undefined,
    from,
    to,
  };
}
