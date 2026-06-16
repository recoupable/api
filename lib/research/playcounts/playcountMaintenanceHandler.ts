import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { songstatsBackfillWorkflow } from "@/app/workflows/songstatsBackfillWorkflow";
import { startDueMonthlySnapshots } from "@/lib/research/playcounts/startDueMonthlySnapshots";
import { reclaimStaleBackfillRows } from "@/lib/supabase/songstats_backfill_queue/reclaimStaleBackfillRows";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * GET /api/internal/playcount-maintenance — daily Vercel Cron entrypoint:
 * starts the Songstats backfill drain workflow and re-runs due monthly
 * snapshot series. Cron-only (CRON_SECRET bearer).
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function playcountMaintenanceHandler(request: NextRequest): Promise<NextResponse> {
  const denied = validateCronRequest(request);
  if (denied) return denied;

  try {
    // Return transiently-failed / orphaned rows to `pending` before draining, so
    // tracks that 429'd in a prior run get retried instead of being stranded.
    const reclaimed = await reclaimStaleBackfillRows();
    const run = await start(songstatsBackfillWorkflow);
    const monthlyStarted = await startDueMonthlySnapshots();

    return NextResponse.json(
      {
        status: "success",
        reclaimed,
        backfill_run_id: run.runId,
        monthly_snapshots_started: monthlyStarted,
      },
      { status: 202, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("[ERROR] playcountMaintenanceHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
