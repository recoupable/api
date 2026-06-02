import { NextRequest, NextResponse } from "next/server";
import { getCreditSpendDigestHandler } from "@/lib/internal/credit-spend-digest/getCreditSpendDigestHandler";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * GET /api/internal/credit-spend-digest — Vercel Cron entrypoint that posts
 * a credit-spend digest to Telegram for the last 10 minutes of `usage_events`.
 * Cron-only (CRON_SECRET bearer); empty window is a no-op.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse describing whether a digest was sent.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getCreditSpendDigestHandler(request);
}
