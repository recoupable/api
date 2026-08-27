import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";
import { mapToAccountCreditsError } from "@/lib/credits/mapToAccountCreditsError";
import { formatCentsAsUsd } from "@/lib/credits/formatCentsAsUsd";
import { validateGetAccountUsageQuery } from "@/lib/usage/validateGetAccountUsageQuery";
import { selectUsageEventsByAccount } from "@/lib/supabase/usage_events/selectUsageEventsByAccount";
import { sumUsageEventsByAccount } from "@/lib/supabase/usage_events/sumUsageEventsByAccount";
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
    const [rows, total] = await Promise.all([
      selectUsageEventsByAccount({
        accountId,
        ...period,
        cursor: query.cursor,
        limit: query.limit,
      }),
      sumUsageEventsByAccount({ accountId, ...period }),
    ]);
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
