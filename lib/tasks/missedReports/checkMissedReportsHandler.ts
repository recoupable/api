import { NextRequest, NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/internal/validateCronRequest";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { sendMessage } from "@/lib/telegram/sendMessage";
import { listScheduledReportRuns } from "./listScheduledReportRuns";
import { findMissedReport } from "./findMissedReport";
import { sendMissedReportNotice } from "./sendMissedReportNotice";
import { formatMissedReportsAlert } from "./formatMissedReportsAlert";
import type { NotifiedMissedReport } from "./types";

const HOUR_MS = 60 * 60_000;
/** Long reports finish well inside two hours; checking the hour that began three hours ago leaves at least that. */
const HOURS_BACK = 3;

/**
 * Handler for `GET /api/internal/missed-report-check` (recoupable/app#1949,
 * #2022). Cron-only. Finds scheduled runs that started 2-3 hours ago and
 * asked for an email but sent none — plan-blocked, stalled, rejected or
 * simply skipped — then emails the owner (see `sendMissedReportNotice`) and
 * posts one Telegram alert. The window is the clock hour that started three
 * hours ago, so each run lands in exactly one window whatever second the cron
 * fires; a duplicated cron delivery re-alerts the team, but the customer
 * notice carries a per-run idempotency key. One run that cannot be checked
 * is counted and skipped rather than ending the batch.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with how many runs were checked, missed and notified.
 */
export async function checkMissedReportsHandler(request: NextRequest): Promise<NextResponse> {
  const unauthorized = validateCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const currentHour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    const windowStart = currentHour - HOURS_BACK * HOUR_MS;
    const runs = await listScheduledReportRuns({
      from: new Date(windowStart).toISOString(),
      to: new Date(windowStart + HOUR_MS - 1).toISOString(),
    });

    const misses: NotifiedMissedReport[] = [];
    let unchecked = 0;
    for (const run of runs) {
      try {
        const [task] = await selectScheduledActions({ id: run.taskId });
        if (!task || task.enabled === false) continue;

        const miss = await findMissedReport({ run, task });
        if (!miss) continue;

        const customerNotified = await sendMissedReportNotice(miss).catch(error => {
          console.error(`[missed-report-check] notice failed for task ${task.id}:`, error);
          return false;
        });
        misses.push({ ...miss, customerNotified });
      } catch (error) {
        unchecked += 1;
        console.error(`[missed-report-check] could not check run ${run.runId}:`, error);
      }
    }

    if (misses.length > 0 || unchecked > 0) {
      await sendMessage(formatMissedReportsAlert(misses, unchecked));
    }

    return NextResponse.json({
      status: "ok",
      checked: runs.length,
      missed: misses.length,
      notified: misses.filter(miss => miss.customerNotified).length,
      unchecked,
    });
  } catch (error) {
    console.error("[ERROR] checkMissedReportsHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 },
    );
  }
}
