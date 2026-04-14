import type { NextRequest } from "next/server";
import { codingAgentBot } from "@/lib/coding-agent/bot";
import { handleCodingAgentCallback } from "@/lib/coding-agent/handleCodingAgentCallback";

/**
 * POST /api/coding-agent/callback
 *
 * Callback endpoint for the coding agent Trigger.dev task. Receives the task result
 * payload and posts it back to the originating Slack thread. The request is
 * authenticated by the shared secret checked inside `handleCodingAgentCallback`
 * (not by `x-api-key`), since it is called server-to-server from Trigger.dev.
 *
 * @param request - The incoming callback request from the Trigger.dev task. The JSON
 *   body carries the task outcome plus `thread_ts` / `channel` so the bot knows where
 *   to reply in Slack.
 * @returns A 200 NextResponse when the Slack post succeeds, 401 if the shared secret
 *   is missing or wrong, or 500 if Slack posting fails.
 */
export async function POST(request: NextRequest) {
  await codingAgentBot.initialize();
  return handleCodingAgentCallback(request);
}
