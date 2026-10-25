import { createPlatformRoutes } from "@/lib/agents/createPlatformRoutes";
import { isContentAgentConfigured } from "@/lib/agents/content/isContentAgentConfigured";

/**
 * GET & POST /api/content-agent/[platform]
 *
 * Webhook endpoints for the content agent bot.
 * Handles Slack webhooks via dynamic [platform] segment.
 */
export const { GET, POST } = createPlatformRoutes({
  getPlatforms: () => ["slack"],
  getSigningSecret: () => process.env.SLACK_CONTENT_SIGNING_SECRET,
  getBot: async () => {
    const { contentAgentBot } = await import("@/lib/agents/content/bot");
    await import("@/lib/agents/content/handlers/registerHandlers");
    return contentAgentBot!;
  },
  isConfigured: isContentAgentConfigured,
});
