import type { NextRequest } from "next/server";
import { handleCodingAgentCallback } from "@/lib/coding-agent/handleCodingAgentCallback";

/**
 * POST /api/coding-agent/callback
 *
 * Callback endpoint for the coding agent Trigger.dev task.
 * Receives task results and posts them back to the Slack thread.
 *
 * @param request - The incoming callback request
 */
export async function POST(request: NextRequest) {
  return handleCodingAgentCallback(request);
}
