import type { NextRequest } from "next/server";
import { codingAgentBot } from "@/lib/coding-agent/bot";
import { handleCodingAgentCallback } from "@/lib/coding-agent/handleCodingAgentCallback";

/**
 * POST /api/coding-agent/callback
 *
 * Callback endpoint for the coding agent Trigger.dev task.
 * Receives task results and posts them back to the Slack thread.
 *
 * @param request - The incoming callback request
 * @returns A NextResponse indicating success or failure of the callback processing
 */
export async function POST(request: NextRequest) {
  await codingAgentBot.initialize();
  return handleCodingAgentCallback(request);
}
