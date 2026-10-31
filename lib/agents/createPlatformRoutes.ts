import type { NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { validatePlatformWebhookRequest } from "@/lib/agents/validatePlatformWebhookRequest";

const platformSchema = z.object({
  platform: z.string().min(1),
});

type WebhookHandler = (
  request: Request,
  options?: { waitUntil?: (task: Promise<unknown>) => void },
) => Promise<Response>;

interface AgentBotLike {
  webhooks: Record<string, WebhookHandler>;
}

interface PlatformRouteConfig {
  getBot: () => AgentBotLike | Promise<AgentBotLike>;
  getPlatforms: () => readonly string[];
  getSigningSecret: (platform: string) => string | undefined;
  getWhatsAppVerifyToken?: () => string | undefined;
  isConfigured?: () => boolean;
}

/**
 * Creates GET and POST route handlers for a [platform] webhook route.
 * Shared across agent bots (coding-agent, content-agent) to avoid duplication.
 *
 * @param config - Lazy bot accessor, adapter names, signature secrets, optional env guard
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
    return handle(request, await params);
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
    return handle(request, await params);
  }

  /** Validates before loading singleton modules; the SDK owns initialization. */
  async function handle(request: NextRequest, params: { platform: string }) {
    const parsed = platformSchema.safeParse(params);
    if (!parsed.success) {
      return Response.json({ error: "Invalid platform parameter" }, { status: 400 });
    }

    const { platform } = parsed.data;

    if (!config.getPlatforms().includes(platform)) {
      return Response.json({ error: "Unknown platform" }, { status: 404 });
    }

    const verification = await validatePlatformWebhookRequest(
      request,
      platform,
      config.getSigningSecret(platform),
      config.getWhatsAppVerifyToken?.(),
    );
    if (verification) return verification;

    if (config.isConfigured && !config.isConfigured()) {
      return Response.json({ error: "Agent not configured" }, { status: 503 });
    }

    try {
      const bot = await config.getBot();
      const handler = Object.hasOwn(bot.webhooks, platform) ? bot.webhooks[platform] : undefined;
      if (!handler) {
        return Response.json({ error: "Unknown platform" }, { status: 404 });
      }
      return await handler(request, { waitUntil: p => after(() => p) });
    } catch {
      return Response.json({ error: "Agent webhook unavailable" }, { status: 500 });
    }
  }

  return { GET, POST };
}
