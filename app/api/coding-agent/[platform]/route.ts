import { createPlatformRoutes } from "@/lib/agents/createPlatformRoutes";
import { isWhatsAppConfigured } from "@/lib/coding-agent/whatsApp/isWhatsAppConfigured";

/**
 * GET & POST /api/coding-agent/[platform]
 *
 * Webhook endpoints for the coding agent bot.
 * Handles Slack, GitHub, and WhatsApp webhooks via dynamic [platform] segment.
 */
export const { GET, POST } = createPlatformRoutes({
  getPlatforms: () => ["slack", "github", ...(isWhatsAppConfigured() ? ["whatsapp"] : [])],
  getSigningSecret: platform => {
    if (platform === "slack") return process.env.SLACK_SIGNING_SECRET;
    if (platform === "github") return process.env.GITHUB_WEBHOOK_SECRET;
    return process.env.WHATSAPP_APP_SECRET;
  },
  getWhatsAppVerifyToken: () => process.env.WHATSAPP_VERIFY_TOKEN,
  getBot: async () => {
    const { codingAgentBot } = await import("@/lib/coding-agent/bot");
    await import("@/lib/coding-agent/handlers/registerHandlers");
    return codingAgentBot;
  },
});
