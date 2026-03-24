import type { NextRequest } from "next/server";
import { after } from "next/server";
import { getContentAgentBot } from "@/lib/content-agent/bot";
import { handleUrlVerification } from "@/lib/slack/handleUrlVerification";
import { ensureHandlersRegistered } from "@/lib/content-agent/handlers/registerHandlers";

/**
 * GET /api/content-agent/[platform]
 *
 * Handles webhook verification handshakes for the content agent bot.
 *
 * @param request - The incoming verification request
 * @param params - Route params wrapper
 * @param params.params - Promise resolving to the platform name
 * @returns The webhook verification response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  ensureHandlersRegistered();
  const bot = getContentAgentBot();

  const handler = bot.webhooks[platform as keyof typeof bot.webhooks];

  if (!handler) {
    return new Response("Unknown platform", { status: 404 });
  }

  return handler(request, { waitUntil: p => after(() => p) });
}

/**
 * POST /api/content-agent/[platform]
 *
 * Webhook endpoint for the content agent bot.
 * Handles Slack webhooks via dynamic [platform] segment.
 *
 * @param request - The incoming webhook request
 * @param params - Route params wrapper
 * @param params.params - Promise resolving to the platform name
 * @returns The webhook response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  if (platform === "slack") {
    const verification = await handleUrlVerification(request);
    if (verification) return verification;
  }

  ensureHandlersRegistered();
  const bot = getContentAgentBot();
  await bot.initialize();

  const handler = bot.webhooks[platform as keyof typeof bot.webhooks];

  if (!handler) {
    return new Response("Unknown platform", { status: 404 });
  }

  return handler(request, { waitUntil: p => after(() => p) });
}
