import { NextRequest, NextResponse } from "next/server";
import { playcountMaintenanceHandler } from "@/lib/research/playcounts/playcountMaintenanceHandler";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * GET /api/internal/playcount-maintenance — Vercel Cron entrypoint that
 * drains the Songstats backfill queue (budget-gated) and re-runs due monthly
 * snapshots. Cron-only (CRON_SECRET bearer).
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with the started run ids.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return playcountMaintenanceHandler(request);
}
