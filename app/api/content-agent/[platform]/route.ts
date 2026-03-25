import { createPlatformRoutes } from "@/lib/agents/createPlatformRoutes";
import { getContentAgentBot } from "@/lib/agents/content/bot";
import { ensureHandlersRegistered } from "@/lib/agents/content/handlers/registerHandlers";
import { isContentAgentConfigured } from "@/lib/agents/content/validateEnv";

/**
 * GET & POST /api/content-agent/[platform]
 *
 * Webhook endpoints for the content agent bot.
 * Handles Slack webhooks via dynamic [platform] segment.
 */
export const { GET, POST } = createPlatformRoutes({
  getBot: getContentAgentBot,
  ensureHandlers: ensureHandlersRegistered,
  isConfigured: isContentAgentConfigured,
});
