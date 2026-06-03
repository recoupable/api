import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/telegram/sendMessage";
import { getCreditSpendDigest } from "@/lib/supabase/usage_events/getCreditSpendDigest";
import { validateGetCreditSpendDigestRequest } from "./validateGetCreditSpendDigestRequest";
import { formatCreditSpendDigest } from "./formatCreditSpendDigest";

/** Look-back window in minutes; matches the cron cadence in vercel.json. */
const WINDOW_MINUTES = 10;
/** Max accounts to include in the digest. */
const TOP_N = 10;

/**
 * Handler for `GET /api/internal/credit-spend-digest`.
 *
 * Cron-only. Aggregates `usage_events` spend over the last
 * `WINDOW_MINUTES` via the `get_credit_spend_digest` Postgres function and
 * posts a top-spenders summary to Telegram. An empty window is a no-op (no
 * ping). The window is stateless (`now - WINDOW_MINUTES`), so minor
 * boundary drift between runs is accepted.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse describing whether a digest was sent.
 */
export async function getCreditSpendDigestHandler(request: NextRequest): Promise<NextResponse> {
  const unauthorized = validateGetCreditSpendDigestRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const sinceIso = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const rows = await getCreditSpendDigest(sinceIso, TOP_N);

    if (rows.length === 0) {
      return NextResponse.json({ status: "ok", sent: false, accounts: 0 });
    }

    await sendMessage(formatCreditSpendDigest(rows, WINDOW_MINUTES));
    return NextResponse.json({ status: "ok", sent: true, accounts: rows.length });
  } catch (error) {
    console.error("[ERROR] getCreditSpendDigestHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
