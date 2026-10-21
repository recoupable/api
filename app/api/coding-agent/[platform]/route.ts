import { createPlatformRoutes } from "@/lib/agents/createPlatformRoutes";
import { codingAgentBot } from "@/lib/coding-agent/bot";
import "@/lib/coding-agent/handlers/registerHandlers";

/**
 * GET & POST /api/coding-agent/[platform]
 *
 * Webhook endpoints for the coding agent bot.
 * Handles Slack, GitHub, and WhatsApp webhooks via dynamic [platform] segment.
 */
export const { GET, POST } = createPlatformRoutes({
  getSlackSigningSecret: () => process.env.SLACK_SIGNING_SECRET,
  getBot: () => codingAgentBot,
});
