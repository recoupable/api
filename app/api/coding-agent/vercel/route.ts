import type { NextRequest } from "next/server";
import { handleVercelWebhook } from "@/lib/coding-agent/handleVercelWebhook";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/coding-agent/vercel
 *
 * Webhook endpoint for Vercel deployment.error events.
 * When a build fails, triggers the update-pr task to diagnose
 * the error using the Vercel CLI and fix the code.
 *
 * @param request - The incoming Vercel webhook request
 * @returns A NextResponse
 */
export async function POST(request: NextRequest) {
  return handleVercelWebhook(request);
}
