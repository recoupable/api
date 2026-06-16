import { getBackfillBudgetStep } from "@/app/workflows/getBackfillBudgetStep";
import { claimBackfillRowsStep } from "@/app/workflows/claimBackfillRowsStep";
import { backfillTrackStep } from "@/app/workflows/backfillTrackStep";

const BATCH_SIZE = 25;

/**
 * Durable Songstats backfill drain (recoupable/chat#1791 write path): claim
 * value-ranked rows via the SKIP LOCKED RPC and backfill each track's historic
 * series, with per-track exponential backoff handling Songstats' rate limit
 * (chat#1797). **Stops as soon as a track defers** — Songstats still
 * rate-limiting it past the backoff bound — leaving the rest `pending` for the
 * next drain instead of hammering a saturated API. Every successful hit converts
 * into permanent owned data (fetch-once: captured history is never refetched).
 */
export async function songstatsBackfillWorkflow() {
  "use workflow";

  let budget = await getBackfillBudgetStep();
  let backfilled = 0;
  let failed = 0;
  let deferred = false;

  drain: while (budget > 0) {
    const rows = await claimBackfillRowsStep(Math.min(budget, BATCH_SIZE));
    if (rows.length === 0) break;
    console.log(`[songstats-backfill] claimed ${rows.length} rows`);

    for (const row of rows) {
      const result = await backfillTrackStep(row);
      if (result.deferred) {
        // Songstats is saturated — stop now; remaining claimed rows stay pending.
        deferred = true;
        break drain;
      }
      budget -= result.hitsSpent;
      if (result.ok) backfilled += 1;
      else failed += 1;
      if (budget <= 0) break;
    }
  }

  console.log(
    `[songstats-backfill] done: ${backfilled} backfilled, ${failed} terminal` +
      (deferred ? ", deferred (rate-limited)" : ""),
  );
  return { backfilled, failed, deferred };
}
