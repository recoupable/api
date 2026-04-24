import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { handleApifyWebhookHandler } from "@/lib/apify/webhooks/handleApifyWebhookHandler";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/apify/webhooks/socials — Apify webhook receiver for social
 * profile scrapers (Instagram, TikTok, YouTube, Threads, Twitter, Facebook).
 *
 * @param request - Incoming Apify webhook callback.
 * @returns JSON `{ social }` (the upserted row, or null).
 */
export async function POST(request: NextRequest) {
  return handleApifyWebhookHandler(request);
}
