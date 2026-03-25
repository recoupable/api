import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getContentAgentBot } from "@/lib/content-agent/bot";
import { handleContentAgentCallback } from "@/lib/content-agent/handleContentAgentCallback";
import { isContentAgentConfigured } from "@/lib/content-agent/validateEnv";

/**
 * POST /api/content-agent/callback
 *
 * Callback endpoint for the poll-content-run Trigger.dev task.
 * Verifies the callback secret before initializing the bot,
 * then delegates to the handler for body validation and processing.
 *
 * @param request - The incoming callback request
 * @returns The callback response
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-callback-secret");
  const expectedSecret = process.env.CONTENT_AGENT_CALLBACK_SECRET;

  if (
    !secret ||
    !expectedSecret ||
    secret.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
  ) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  if (!isContentAgentConfigured()) {
    return Response.json({ error: "Content agent not configured" }, { status: 503 });
  }

  await getContentAgentBot().initialize();
  return handleContentAgentCallback(request);
}
