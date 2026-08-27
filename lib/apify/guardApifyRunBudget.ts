import { selectApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRun";
import { countApifyScraperRunsForAccount } from "@/lib/supabase/apify_scraper_runs/countApifyScraperRunsForAccount";
import { countApifyRunDescendants } from "@/lib/apify/countApifyRunDescendants";
import { sendMessage } from "@/lib/telegram/sendMessage";
import type { Tables } from "@/types/database.types";

/**
 * Hard ceilings on webhook-spawned runs (app#2018, defense in depth behind
 * the origin guard). A healthy artist scrape spawns 2 runs; 50 per scrape
 * and 150 per account per hour are far above any legitimate chain and far
 * below the ~300/hour the unbounded crawl reached.
 */
export const APIFY_RUN_BUDGET = { perScrape: 50, perAccountPerHour: 150 } as const;

type GuardApifyRunBudgetParams = { parentRunId: string; platform: string };
export type ApifyRunBudgetVerdict =
  | { allowed: true }
  | { allowed: false; reason: "per_scrape_cap" | "per_account_hourly_cap" };

const ROOT_WALK_LIMIT = 6;

/** Walks `parent_run_id` up to the run a scrape endpoint started. */
async function resolveRoot(parentRunId: string): Promise<Tables<"apify_scraper_runs"> | null> {
  let row = await selectApifyScraperRun(parentRunId);
  for (let i = 0; row?.parent_run_id && i < ROOT_WALK_LIMIT; i++) {
    const up = await selectApifyScraperRun(row.parent_run_id);
    if (!up) break;
    row = up;
  }
  return row;
}

async function alert(text: string): Promise<void> {
  console.error(`[ERROR] apify run budget tripped: ${text}`);
  try {
    await sendMessage(`*Apify run budget tripped*\n${text}`);
  } catch (error) {
    console.error("[WARN] budget alert failed:", error);
  }
}

/**
 * Decides whether a webhook handler may spawn one more run under
 * `parentRunId`. Blocks (and alerts) once the originating scrape has spawned
 * `perScrape` runs, or the owning account has started `perAccountPerHour`
 * runs in the last hour. Alerts are naturally bounded: a blocked run never
 * starts, so no further webhooks arrive for that chain.
 *
 * The check is read-then-spawn, not an atomic reservation: webhooks already
 * in flight for the same chain can each pass and overshoot a cap by that
 * handful. Acceptable for a ceiling set at 25x a healthy chain.
 *
 * Fails open on an unregistered parent (nothing to budget; the origin guard
 * already makes such chains terminal) and on a database error (bookkeeping
 * must never stop persistence).
 */
export async function guardApifyRunBudget({
  parentRunId,
  platform,
}: GuardApifyRunBudgetParams): Promise<ApifyRunBudgetVerdict> {
  try {
    const root = await resolveRoot(parentRunId);
    if (!root) return { allowed: true };

    const spawned = await countApifyRunDescendants(root.run_id, APIFY_RUN_BUDGET.perScrape);
    if (spawned >= APIFY_RUN_BUDGET.perScrape) {
      await alert(
        `scrape ${root.run_id} (${platform}, account ${root.account_id ?? "unknown"}) has spawned ${spawned} runs; cap ${APIFY_RUN_BUDGET.perScrape}. Not starting more.`,
      );
      return { allowed: false, reason: "per_scrape_cap" };
    }

    if (root.account_id) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const hourly = await countApifyScraperRunsForAccount({ accountId: root.account_id, since });
      if (hourly >= APIFY_RUN_BUDGET.perAccountPerHour) {
        await alert(
          `account ${root.account_id} started ${hourly} runs in the last hour (latest chain ${root.run_id}, ${platform}); cap ${APIFY_RUN_BUDGET.perAccountPerHour}. Not starting more.`,
        );
        return { allowed: false, reason: "per_account_hourly_cap" };
      }
    }
    return { allowed: true };
  } catch (error) {
    console.error("[WARN] guardApifyRunBudget failed open:", error);
    return { allowed: true };
  }
}
