import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";
import { mapToAccountCreditsError } from "@/lib/credits/mapToAccountCreditsError";
import { formatCentsAsUsd } from "@/lib/credits/formatCentsAsUsd";
import { validateGetAccountUsageQuery } from "@/lib/usage/validateGetAccountUsageQuery";
import { selectUsageEvents } from "@/lib/supabase/usage_events/selectUsageEvents";
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
    const accountId = await validateAccountCreditsParams(request, id);
    if (accountId instanceof NextResponse) {
      return mapToAccountCreditsError(accountId);
    }

    const query = validateGetAccountUsageQuery(request);
    if (query instanceof NextResponse) {
      return query;
    }

    const period = { from: query.from, to: query.to };
    // The page ends at the cursor when one is given and it falls inside the
    // period; the total always covers the whole period.
    const pageBefore =
      query.cursor && new Date(query.cursor) < new Date(query.to) ? query.cursor : query.to;
    const [rows, periodRows] = await Promise.all([
      selectUsageEvents({
        accountId,
        createdAfter: query.from,
        createdBefore: pageBefore,
        from: 0,
        to: query.limit - 1,
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
        next_cursor: events.length === query.limit && last ? last.created_at : null,
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
