import type { NextRequest } from "next/server";
import { after } from "next/server";
import { codingAgentBot } from "@/lib/coding-agent/bot";
import "@/lib/coding-agent/handlers/registerHandlers";

/**
 * GET /api/coding-agent/[platform]
 *
 * Handles webhook verification handshakes (e.g. WhatsApp hub.challenge).
 *
 * @param request - The incoming verification request
 * @param params - Route params containing the platform name
 */
export async function GET(
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

/**
 * POST /api/coding-agent/[platform]
 *
 * Webhook endpoint for the coding agent bot.
 * Handles Slack and WhatsApp webhooks via dynamic [platform] segment.
 *
 * @param request - The incoming webhook request
 * @param params - Route params containing the platform name
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  // Handle Slack url_verification challenge before loading the bot.
  // This avoids blocking on Redis/adapter initialization during setup.
  if (platform === "slack") {
    const body = await request.clone().json().catch(() => null);
    if (body?.type === "url_verification" && body?.challenge) {
      return Response.json({ challenge: body.challenge });
    }
  }

  await codingAgentBot.initialize();

  const handler = codingAgentBot.webhooks[platform as keyof typeof codingAgentBot.webhooks];

  if (!handler) {
    return new Response("Unknown platform", { status: 404 });
  }

  return handler(request, { waitUntil: p => after(() => p) });
}
