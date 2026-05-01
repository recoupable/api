import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { handleUrlVerification } from "@/lib/slack/handleUrlVerification";

const platformSchema = z.object({
  platform: z.string().min(1),
});

type WebhookHandler = (
  request: Request,
  options?: { waitUntil?: (task: Promise<unknown>) => void },
) => Promise<Response>;

interface AgentBotLike {
  webhooks: Record<string, WebhookHandler>;
  initialize(): Promise<void>;
}

interface PlatformRouteConfig {
  getBot: () => AgentBotLike;
  ensureHandlers?: () => void;
  isConfigured?: () => boolean;
}

/**
 * Creates GET and POST route handlers for a [platform] webhook route.
 * Shared across agent bots (coding-agent, content-agent) to avoid duplication.
 *
 * @param config - Bot accessor, optional handler registration, optional env guard
 * @returns GET and POST route handlers for Next.js App Router
 */
export function createPlatformRoutes(config: PlatformRouteConfig) {
  /**
   * Handles webhook verification handshakes (e.g. WhatsApp hub.challenge).
   *
   * @param request - The incoming verification request
   * @param root0 - Route params wrapper
   * @param root0.params - Promise resolving to the platform name
   * @returns The webhook verification response
   */
  async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
    if (config.isConfigured && !config.isConfigured()) {
      return Response.json({ error: "Agent not configured" }, { status: 503 });
    }

    const parsed = platformSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid platform parameter" }, { status: 400 });
    }

    const { platform } = parsed.data;
    config.ensureHandlers?.();

    const bot = config.getBot();
    const handler = bot.webhooks[platform];

    if (!handler) {
      return Response.json({ error: "Unknown platform" }, { status: 404 });
    }

    return handler(request, { waitUntil: p => after(() => p) });
  }

  /**
   * Handles incoming webhook events from the platform adapter.
   *
   * @param request - The incoming webhook request
   * @param root0 - Route params wrapper
   * @param root0.params - Promise resolving to the platform name
   * @returns The webhook response
   */
  async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
    const parsed = platformSchema.safeParse(await params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid platform parameter" }, { status: 400 });
    }

    const { platform } = parsed.data;

    if (platform === "slack") {
      const verification = await handleUrlVerification(request);
      if (verification) return verification;
    }

    if (config.isConfigured && !config.isConfigured()) {
      return Response.json({ error: "Agent not configured" }, { status: 503 });
    }

    config.ensureHandlers?.();

    const bot = config.getBot();
    await bot.initialize();

    const handler = bot.webhooks[platform];

    if (!handler) {
      return Response.json({ error: "Unknown platform" }, { status: 404 });
    }

    return handler(request, { waitUntil: p => after(() => p) });
  }

  return { GET, POST };
}
