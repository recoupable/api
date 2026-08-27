import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { formatCentsAsUsd } from "@/lib/credits/formatCentsAsUsd";
import { validateGetAccountUsageQuery } from "@/lib/usage/validateGetAccountUsageQuery";
import { selectUsagePage } from "@/lib/usage/selectUsagePage";
import { encodeUsageCursor } from "@/lib/usage/encodeUsageCursor";
import { selectAllUsageEvents } from "@/lib/admins/credits/selectAllUsageEvents";
import { sumCreditsDeducted } from "@/lib/usage/sumCreditsDeducted";
import { toUsageEvent } from "@/lib/usage/toUsageEvent";

/**
 * GET /api/accounts/[id]/usage
 *
 * The account's charge line items, newest first, with the period total
 * aggregated in the database. Access rules are those of the credits balance.
 */
export async function getAccountUsageHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const query = await validateGetAccountUsageQuery(request, id);
    if (query instanceof NextResponse) {
      return query;
    }
    const { accountId } = query;

    const period = { from: query.from, to: query.to };
    const [rows, periodRows] = await Promise.all([
      selectUsagePage({
        accountId,
        from: query.from,
        to: query.to,
        sort: query.sort,
        cursor: query.cursor,
        limit: query.limit,
      }),
      selectAllUsageEvents({ accountId, createdAfter: query.from, createdBefore: query.to }),
    ]);
    const total = sumCreditsDeducted(periodRows);
    const events = rows.map(toUsageEvent);
    const last = events[events.length - 1];

    return NextResponse.json(
      {
        account_id: accountId,
        period,
        total_credits_deducted: total,
        total_usd: formatCentsAsUsd(total),
        events,
        next_cursor:
          events.length === query.limit && last ? encodeUsageCursor(query.sort, last) : null,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[getAccountUsageHandler]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
