import type { NextRequest } from "next/server";
import { after } from "next/server";

/**
 * POST /api/coding-agent/[platform]
 *
 * Webhook endpoint for the coding agent bot.
 * Handles Slack webhooks via dynamic [platform] segment.
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

  // Handle Slack url_verification challenge before loading the bot.
  // This avoids blocking on Redis/adapter initialization during setup.
  if (platform === "slack") {
    const body = await request.clone().json().catch(() => null);
    if (body?.type === "url_verification" && body?.challenge) {
      return Response.json({ challenge: body.challenge });
    }
  }

  try {
    // Lazy-import bot to isolate initialization errors
    const { codingAgentBot } = await import("@/lib/coding-agent/bot");
    await import("@/lib/coding-agent/handlers/registerHandlers");

    const handler = codingAgentBot.webhooks[platform as keyof typeof codingAgentBot.webhooks];

    if (!handler) {
      return new Response("Unknown platform", { status: 404 });
    }

    return handler(request, { waitUntil: p => after(() => p) });
  } catch (error) {
    console.error("[coding-agent] Failed to initialize bot:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
