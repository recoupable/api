import type { NextRequest } from "next/server";
import { after } from "next/server";
import { slackChatBot } from "@/lib/slack-chat/bot";
import { handleUrlVerification } from "@/lib/slack/handleUrlVerification";
import "@/lib/slack-chat/handlers/registerHandlers";

/**
 * GET /api/chat/slack
 *
 * Handles Slack webhook verification handshake.
 *
 * @param request - The incoming verification request
 * @returns The webhook handler response
 */
export async function GET(request: NextRequest) {
  return slackChatBot.webhooks.slack(request, { waitUntil: p => after(() => p) });
}

/**
 * POST /api/chat/slack
 *
 * Webhook endpoint for the Record Label Agent Slack bot.
 * Handles url_verification challenges and delegates messages to the bot.
 *
 * @param request - The incoming webhook request
 * @returns The webhook handler response or url_verification challenge
 */
export async function POST(request: NextRequest) {
  const verification = await handleUrlVerification(request);
  if (verification) return verification;

  await slackChatBot.initialize();

  return slackChatBot.webhooks.slack(request, { waitUntil: p => after(() => p) });
}
