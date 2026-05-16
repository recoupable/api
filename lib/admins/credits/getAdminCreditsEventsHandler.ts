import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { selectAdminCreditsEvents } from "@/lib/supabase/usage_events/selectAdminCreditsEvents";
import { getCutoffMs } from "@/lib/admins/getCutoffMs";
import { validateGetAdminCreditsEventsQuery } from "./validateGetAdminCreditsEventsQuery";

/**
 * Handler for `GET /api/admins/credits/events`.
 *
 * Returns raw `usage_events` rows for one account in the selected period,
 * sorted by `created_at` descending. Powers the drilldown subtable that
 * expands when an admin opens a rollup row. See the OpenAPI contract on
 * the recoupable/docs site for the full request/response shape.
 *
 * Requires the caller to be a Recoup admin.
 */
export async function getAdminCreditsEventsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validated = validateGetAdminCreditsEventsQuery(request);
    if (validated instanceof NextResponse) return validated;

    const { account_id, period, limit, page } = validated;

    const cutoffMs = getCutoffMs(period);
    const { rows, totalCount } = await selectAdminCreditsEvents({
      accountId: account_id,
      createdAfter: cutoffMs === null ? undefined : new Date(cutoffMs).toISOString(),
      page,
      limit,
    });

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
