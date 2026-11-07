import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { sendMessage } from "@/lib/telegram/sendMessage";
import { listScheduledReportRuns } from "./listScheduledReportRuns";
import { findMissedReport } from "./findMissedReport";
import { sendMissedReportNotice } from "./sendMissedReportNotice";
import { formatMissedReportsAlert } from "./formatMissedReportsAlert";
import type { NotifiedMissedReport } from "./types";

/** Long reports finish well inside this; a run still silent after it has failed. */
const GRACE_MINUTES = 120;
/** Matches the hourly cron, so each run falls in exactly one check. */
const WINDOW_MINUTES = 60;

/**
 * Handler for `GET /api/internal/missed-report-check` (recoupable/app#1949,
 * #2022). Cron-only. Finds scheduled runs that started 2-3 hours ago and
 * asked for an email but sent none — plan-blocked, stalled, rejected or
 * simply skipped — then emails the owner (see `sendMissedReportNotice`) and
 * posts one Telegram alert. Stateless: the window does the deduplication.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with how many runs were checked, missed and notified.
 */
export async function checkMissedReportsHandler(request: NextRequest): Promise<NextResponse> {
  const unauthorized = validateCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const now = Date.now();
    const runs = await listScheduledReportRuns({
      from: new Date(now - (GRACE_MINUTES + WINDOW_MINUTES) * 60_000).toISOString(),
      to: new Date(now - GRACE_MINUTES * 60_000).toISOString(),
    });

    const misses: NotifiedMissedReport[] = [];
    for (const run of runs) {
      const [task] = await selectScheduledActions({ id: run.taskId });
      if (!task || task.enabled === false) continue;

      const miss = await findMissedReport({ run, task });
      if (!miss) continue;

      const customerNotified = await sendMissedReportNotice(miss).catch(error => {
        console.error(`[missed-report-check] notice failed for task ${task.id}:`, error);
        return false;
      });
      misses.push({ ...miss, customerNotified });
    }

    if (misses.length > 0) await sendMessage(formatMissedReportsAlert(misses));

    return NextResponse.json({
      status: "ok",
      checked: runs.length,
      missed: misses.length,
      notified: misses.filter(miss => miss.customerNotified).length,
    });
  } catch (error) {
    console.error("[ERROR] checkMissedReportsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
