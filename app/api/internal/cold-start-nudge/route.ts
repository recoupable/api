import { NextRequest, NextResponse } from "next/server";
import { coldStartNudgeHandler } from "@/lib/onboarding/coldStartNudgeHandler";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * GET /api/internal/cold-start-nudge — daily Vercel Cron entrypoint that nudges
 * accounts welcomed 1 to 14 days ago that still have no artist on the roster.
 * Cron-only (CRON_SECRET bearer); deduped per account via the
 * `cold_start_nudge_email` marker in `email_send_log`.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse describing how many accounts were nudged.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return coldStartNudgeHandler(request);
}
