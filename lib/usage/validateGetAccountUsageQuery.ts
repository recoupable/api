import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";
import { mapToAccountCreditsError } from "@/lib/credits/mapToAccountCreditsError";
import { decodeUsageCursor } from "@/lib/usage/decodeUsageCursor";
import type { UsageCursor, UsageSort } from "@/lib/usage/usageSort";
import { startOfCurrentUtcMonth } from "@/lib/usage/startOfCurrentUtcMonth";
import { invalidCursorMessage } from "@/lib/usage/invalidCursorMessage";

const iso = z.string().datetime({ offset: true });

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["created_at", "cost"]).default("created_at"),
  cursor: z.string().min(1).optional(),
  from: iso.optional(),
  to: iso.optional(),
});

export interface GetAccountUsageQuery {
  /** The account whose charges are listed; the caller is that account or has org access to it. */
  accountId: string;
  limit: number;
  /** Sort order, both descending: by time (default) or by charge. */
  sort: UsageSort;
  /** Keyset of the last item on the previous page, decoded for `sort`. */
  cursor: UsageCursor | undefined;
  /** Inclusive lower bound on `created_at`, ISO 8601 UTC. */
  from: string;
  /** Exclusive upper bound on `created_at`, ISO 8601 UTC. */
  to: string;
}

/**
 * Validates a `GET /api/accounts/{id}/usage` request: the account gate first
 * (the credits-balance rule, `validateAccountCreditsParams`: the caller is the
 * account or has organization access to it), then the query string.
 *
 * Defaults: `limit` 20, `from` the start of the current UTC month, `to` now.
 * Timestamps are normalised to UTC ISO strings so the response `period` and
 * the database filters carry one representation.
 *
 * @param request - The incoming request.
 * @param id - The `{id}` path segment.
 * @returns The validated request, or a NextResponse with `{ error }` (401/403
 *   from the gate, 400 for the path id or the query).
 */
export async function validateGetAccountUsageQuery(
  request: NextRequest,
  id: string,
): Promise<GetAccountUsageQuery | NextResponse> {
  const accountId = await validateAccountCreditsParams(request, id);
  if (accountId instanceof NextResponse) {
    return mapToAccountCreditsError(accountId);
  }
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `${issue.path.join(".")}: ${issue.message}` },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const cursor = parsed.data.cursor
    ? decodeUsageCursor(parsed.data.sort, parsed.data.cursor)
    : undefined;
  if (cursor === null) {
    return NextResponse.json(
      { error: invalidCursorMessage(parsed.data.sort) },
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
    accountId,
    limit: parsed.data.limit,
    sort: parsed.data.sort,
    cursor,
    from,
    to,
  };
}
