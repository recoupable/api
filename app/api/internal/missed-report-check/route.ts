import { NextRequest, NextResponse } from "next/server";
import { checkMissedReportsHandler } from "@/lib/tasks/missedReports/checkMissedReportsHandler";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * GET /api/internal/missed-report-check — hourly Vercel Cron entrypoint that
 * finds scheduled reports that sent no email, tells the owner and alerts the
 * team on Telegram. Cron-only (CRON_SECRET bearer).
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with how many runs were checked, missed and notified.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return checkMissedReportsHandler(request);
}
