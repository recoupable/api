import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectUsageEvents } from "@/lib/supabase/usage_events/selectUsageEvents";
import { countUsageEvents } from "@/lib/supabase/usage_events/countUsageEvents";
import { getCutoffMs } from "@/lib/admins/getCutoffMs";
import { validateGetAdminCreditsEventsQuery } from "./validateGetAdminCreditsEventsQuery";

/**
 * Handler for `GET /api/admins/credits/events`.
 *
 * Returns raw `usage_events` rows for one account in the selected period,
 * sorted by `created_at` DESC with `id` DESC as tiebreaker. Powers the
 * drilldown subtable that expands when an admin opens a rollup row.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with the paginated usage_events rows.
 */
export async function getAdminCreditsEventsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetAdminCreditsEventsQuery(request);
    if (validated instanceof NextResponse) return validated;

    const { account_id, period, limit, page } = validated;

    const cutoffMs = getCutoffMs(period);
    const createdAfter = cutoffMs === null ? undefined : new Date(cutoffMs).toISOString();

    const [rows, totalCount] = await Promise.all([
      selectUsageEvents({ accountId: account_id, createdAfter, page, limit }),
      countUsageEvents({ accountId: account_id, createdAfter }),
    ]);

    return NextResponse.json(
      {
        status: "success",
        account_id,
        period,
        page,
        limit,
        total_count: totalCount,
        events: rows,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getAdminCreditsEventsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
