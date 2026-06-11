import { getBackfillBudgetStep } from "@/app/workflows/getBackfillBudgetStep";
import { claimBackfillRowsStep } from "@/app/workflows/claimBackfillRowsStep";
import { backfillTrackStep } from "@/app/workflows/backfillTrackStep";

const BATCH_SIZE = 25;

/**
 * Durable Songstats backfill drain (recoupable/chat#1791 write path): check
 * the rolling-window budget, claim value-ranked rows via the SKIP LOCKED RPC,
 * backfill each track's historic series into the measurement store, and stop
 * when the queue or the budget is dry. Every quota hit converts into
 * permanent owned data (fetch-once: captured history is never refetched).
 */
export async function songstatsBackfillWorkflow() {
  "use workflow";

  let budget = await getBackfillBudgetStep();
  let backfilled = 0;
  let failed = 0;

  while (budget > 0) {
    const rows = await claimBackfillRowsStep(Math.min(budget, BATCH_SIZE));
    if (rows.length === 0) break;

    for (const row of rows) {
      const result = await backfillTrackStep(row);
      budget -= result.hitsSpent;
      if (result.ok) backfilled += 1;
      else failed += 1;
      if (budget <= 0) break;
    }
  }

  console.log(`[songstats-backfill] done: ${backfilled} backfilled, ${failed} failed`);
  return { backfilled, failed };
}
