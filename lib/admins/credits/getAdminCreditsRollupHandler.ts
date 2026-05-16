import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getCutoffMs } from "@/lib/admins/getCutoffMs";
import { validateGetAdminCreditsRollupQuery } from "./validateGetAdminCreditsRollupQuery";
import { aggregateRollupByAccount } from "./aggregateRollupByAccount";
import { enrichRollupPageWithAccountDetails } from "./enrichRollupPageWithAccountDetails";
import { selectAllUsageEvents } from "./selectAllUsageEvents";

/**
 * Handler for `GET /api/admins/credits/rollup`.
 *
 * Returns the top accounts by total credits deducted over the selected
 * period, joined with `accounts.name` and the most-recent `account_emails.email`
 * for human-readable rows. See the OpenAPI contract on the recoupable/docs
 * site for the full request/response shape.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with the paginated rollup rows.
 */
export async function getAdminCreditsRollupHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetAdminCreditsRollupQuery(request);
    if (validated instanceof NextResponse) return validated;

    const { period, limit, page } = validated;

    const cutoffMs = getCutoffMs(period);
    const events = await selectAllUsageEvents({
      createdAfter: cutoffMs === null ? undefined : new Date(cutoffMs).toISOString(),
    });

    const sorted = aggregateRollupByAccount(events);
    const offset = (page - 1) * limit;
    const rows = await enrichRollupPageWithAccountDetails(sorted.slice(offset, offset + limit));

    return NextResponse.json(
      {
        status: "success",
        period,
        page,
        limit,
        total_count: sorted.length,
        rows,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] getAdminCreditsRollupHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
