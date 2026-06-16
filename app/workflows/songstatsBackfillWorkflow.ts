import { claimBackfillRowsStep } from "@/app/workflows/claimBackfillRowsStep";
import { backfillTrackStep } from "@/app/workflows/backfillTrackStep";
import { releaseClaimedRowsStep } from "@/app/workflows/releaseClaimedRowsStep";

const BATCH_SIZE = 25;

/**
 * Durable Songstats backfill drain (recoupable/chat#1791 write path): claim
 * value-ranked rows via the SKIP LOCKED RPC and backfill each track's historic
 * series. There is **no local quota ledger or budget gate** (chat#1797) —
 * Songstats is the rate authority: per-track exponential backoff absorbs the
 * rate limit, and the run **stops as soon as a track defers** (still retryable
 * past the backoff bound), releasing the rest of the claimed batch back to
 * `pending` so the next drain retries them immediately rather than waiting on
 * stale-reclaim. Otherwise it drains until the queue has no claimable `pending`
 * rows. Every backfill converts into permanent owned data (fetch-once).
 */
export async function songstatsBackfillWorkflow() {
  "use workflow";

  let backfilled = 0;
  let terminal = 0;
  let deferred = false;

  drain: while (true) {
    const rows = await claimBackfillRowsStep(BATCH_SIZE);
    if (rows.length === 0) break;
    console.log(`[songstats-backfill] claimed ${rows.length} rows`);

    for (let i = 0; i < rows.length; i += 1) {
      const result = await backfillTrackStep(rows[i]);
      if (result.deferred) {
        // Songstats is saturated — stop now. The deferred row is already back to
        // `pending`; release the rest of this claimed batch too so they don't sit
        // `in_progress` until stale-reclaim.
        deferred = true;
        await releaseClaimedRowsStep(rows.slice(i + 1).map(r => r.id));
        break drain;
      }
      if (result.ok) backfilled += 1;
      else terminal += 1;
    }
  }

  console.log(
    `[songstats-backfill] done: ${backfilled} backfilled, ${terminal} terminal` +
      (deferred ? ", deferred (rate-limited)" : ""),
  );
  return { backfilled, terminal, deferred };
}
