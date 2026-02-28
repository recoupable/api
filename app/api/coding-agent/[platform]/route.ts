import type { NextRequest } from "next/server";
import { after } from "next/server";
import { codingAgentBot } from "@/lib/coding-agent/bot";
import "@/lib/coding-agent/handlers/registerHandlers";

/**
 * POST /api/coding-agent/[platform]
 *
 * Webhook endpoint for the coding agent bot.
 * Handles both Slack and GitHub webhooks via dynamic [platform] segment.
 *
 * @param request - The incoming webhook request
 * @param params.params
 * @param params - Route params containing the platform name (slack or github)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const handler = codingAgentBot.webhooks[platform as keyof typeof codingAgentBot.webhooks];

  if (!handler) {
    return new Response("Unknown platform", { status: 404 });
  }

  return handler(request, { waitUntil: p => after(() => p) });
}
