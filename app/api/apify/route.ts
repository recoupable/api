import { NextRequest } from "next/server";
import { postApifyWebhookHandler } from "@/lib/apify/postApifyWebhookHandler";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * `POST /api/apify` — Apify webhook receiver. Unauthenticated on the
 * route itself; authenticity is established by the shared actor token
 * that only trusted runs can register. Delegates to the dispatcher.
 *
 * @param request - Incoming webhook request.
 * @returns JSON response describing the processed payload (always 200).
 */
export async function POST(request: NextRequest) {
  return postApifyWebhookHandler(request);
}
