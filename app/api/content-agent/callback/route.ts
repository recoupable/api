import type { NextRequest } from "next/server";
import { contentAgentBot } from "@/lib/content-agent/bot";
import { handleContentAgentCallback } from "@/lib/content-agent/handleContentAgentCallback";

/**
 * POST /api/content-agent/callback
 *
 * Callback endpoint for the poll-content-run Trigger.dev task.
 * Receives task results and posts them back to the Slack thread.
 *
 * @param request - The incoming callback request
 */
export async function POST(request: NextRequest) {
  await contentAgentBot.initialize();
  return handleContentAgentCallback(request);
}
