import { createPlatformRoutes } from "@/lib/agents/createPlatformRoutes";
import { contentAgentBot } from "@/lib/agents/content/bot";
import "@/lib/agents/content/handlers/registerHandlers";

/**
 * GET & POST /api/content-agent/[platform]
 *
 * Webhook endpoints for the content agent bot.
 * Handles Slack webhooks via dynamic [platform] segment.
 */
export const { GET, POST } = createPlatformRoutes({
  getBot: () => contentAgentBot!,
  isConfigured: () => contentAgentBot !== null,
});
