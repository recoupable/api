import type { CodingAgentBot } from "../bot";
import { getAllowedChannelIds, getAllowedUserIds } from "../config";
import { triggerCodingAgent } from "@/lib/trigger/triggerCodingAgent";

/**
 * Registers the onNewMention handler on the bot.
 * Validates channel/user against allowlist, subscribes to the thread,
 * and triggers the coding agent Trigger.dev task.
 *
 * @param bot
 */
export function registerOnNewMention(bot: CodingAgentBot) {
  bot.onNewMention(async (thread, message) => {
    const allowedChannels = getAllowedChannelIds();
    const allowedUsers = getAllowedUserIds();

    if (allowedChannels.length > 0) {
      const channelId = thread.id.split(":")[1];
      if (!allowedChannels.includes(channelId)) {
        return;
      }
    }

    if (allowedUsers.length > 0) {
      const userId = message.author.userId;
      if (!allowedUsers.includes(userId)) {
        return;
      }
    }

    const prompt = message.text;

    try {
      await thread.subscribe();

      await thread.post(`Starting work on: "${prompt}"\n\nI'll reply here when done.`);

      const handle = await triggerCodingAgent({
        prompt,
        callbackThreadId: thread.id,
      });

      await thread.setState({
        status: "running",
        prompt,
        runId: handle.id,
        slackThreadId: thread.id,
      });
    } catch (error) {
      console.error("[coding-agent] onNewMention error:", error);
    }
  });
}
