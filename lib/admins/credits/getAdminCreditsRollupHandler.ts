import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";
import { selectAdminCreditsRollupEvents } from "@/lib/supabase/usage_events/selectAdminCreditsRollupEvents";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { getCutoffMs } from "./getCutoffMs";
import { validateGetAdminCreditsRollupQuery } from "./validateGetAdminCreditsRollupQuery";

interface RollupRow {
  account_id: string;
  account_name: string | null;
  account_email: string | null;
  total_credits_deducted_cents: number;
  event_count: number;
}

/**
 * Handler for `GET /api/admins/credits/rollup`.
 *
 * Returns the top accounts by total credits deducted over the selected
 * period, joined with `accounts.name` and `account_emails.email` for
 * human-readable rows. See the OpenAPI contract on the recoupable/docs
 * site for the full request/response shape.
 *
 * Requires the caller to be a Recoup admin.
 */
export async function getAdminCreditsRollupHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await validateAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const validated = validateGetAdminCreditsRollupQuery(request);
    if (validated instanceof NextResponse) return validated;

    const { period, limit, page } = validated;

    const cutoffMs = getCutoffMs(period);
    const events = await selectAdminCreditsRollupEvents({
      createdAfter: cutoffMs === null ? undefined : new Date(cutoffMs).toISOString(),
    });

    // Aggregate by account_id in memory. Volume is bounded by the period
    // (admin endpoint, low traffic) — if this becomes a hot path we can
    // migrate to a Postgres function via a database-repo migration.
    const aggByAccount = new Map<string, { total: number; count: number }>();
    for (const event of events) {
      const existing = aggByAccount.get(event.account_id) ?? { total: 0, count: 0 };
      aggByAccount.set(event.account_id, {
        total: existing.total + (event.credits_deducted_cents ?? 0),
        count: existing.count + 1,
      });
    }

    const sorted = Array.from(aggByAccount.entries())
      .map(([account_id, v]) => ({
        account_id,
        total_credits_deducted_cents: v.total,
        event_count: v.count,
      }))
      .sort((a, b) => b.total_credits_deducted_cents - a.total_credits_deducted_cents);

    const totalCount = sorted.length;
    const offset = (page - 1) * limit;
    const pageSlice = sorted.slice(offset, offset + limit);

    // Join account name + primary email for the rows we're actually
    // returning (not the full set) to keep the JOIN small.
    const pageAccountIds = pageSlice.map(r => r.account_id);
    const [accounts, emails] = await Promise.all([
      pageAccountIds.length > 0 ? selectAccounts(pageAccountIds) : Promise.resolve([]),
      pageAccountIds.length > 0
        ? selectAccountEmails({ accountIds: pageAccountIds })
        : Promise.resolve([]),
    ]);
    const nameById = new Map(accounts.map(a => [a.id, a.name ?? null]));
    const emailByAccountId = new Map<string, string>();
    for (const row of emails) {
      // First email wins (most rows are 1:1 anyway).
      if (!emailByAccountId.has(row.account_id)) {
        emailByAccountId.set(row.account_id, row.email);
      }
    }

    const rows: RollupRow[] = pageSlice.map(r => ({
      account_id: r.account_id,
      account_name: nameById.get(r.account_id) ?? null,
      account_email: emailByAccountId.get(r.account_id) ?? null,
      total_credits_deducted_cents: r.total_credits_deducted_cents,
      event_count: r.event_count,
    }));

    return NextResponse.json(
      {
        status: "success",
        period,
        page,
        limit,
        total_count: totalCount,
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
