import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { songstatsBackfillWorkflow } from "@/app/workflows/songstatsBackfillWorkflow";
import { startDueMonthlySnapshots } from "@/lib/research/playcounts/startDueMonthlySnapshots";
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
    const run = await start(songstatsBackfillWorkflow);
    const monthlyStarted = await startDueMonthlySnapshots();

    return NextResponse.json(
      { status: "success", backfill_run_id: run.runId, monthly_snapshots_started: monthlyStarted },
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
