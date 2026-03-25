import type { NextRequest } from "next/server";
import { getContentAgentBot } from "@/lib/agents/content/bot";
import { handleContentAgentCallback } from "@/lib/agents/content/handleContentAgentCallback";
import { isContentAgentConfigured } from "@/lib/agents/content/validateEnv";

/**
 * POST /api/content-agent/callback
 *
 * Callback endpoint for the poll-content-run Trigger.dev task.
 * Receives task results and posts them back to the Slack thread.
 *
 * @param request - The incoming callback request
 * @returns The callback response
 */
export async function POST(request: NextRequest) {
  if (!isContentAgentConfigured()) {
    return Response.json({ error: "Content agent not configured" }, { status: 503 });
  }

  await getContentAgentBot().initialize();
  return handleContentAgentCallback(request);
}
