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
    console.log("[coding-agent] onNewMention fired", {
      threadId: thread.id,
      text: message.text.slice(0, 50),
      author: message.author.userId,
    });

    const allowedChannels = getAllowedChannelIds();
    const allowedUsers = getAllowedUserIds();

    if (allowedChannels.length > 0) {
      const channelId = thread.id.split(":")[1];
      if (!allowedChannels.includes(channelId)) {
        console.log("[coding-agent] Channel not allowed", { channelId, allowedChannels });
        return;
      }
    }

    if (allowedUsers.length > 0) {
      const userId = message.author.userId;
      if (!allowedUsers.includes(userId)) {
        console.log("[coding-agent] User not allowed", { userId, allowedUsers });
        return;
      }
    }

    const prompt = message.text;

    try {
      await thread.subscribe();
      console.log("[coding-agent] Subscribed to thread");

      await thread.post(`Starting work on: "${prompt}"\n\nI'll reply here when done.`);
      console.log("[coding-agent] Posted acknowledgment");

      const handle = await triggerCodingAgent({
        prompt,
        callbackThreadId: thread.id,
      });
      console.log("[coding-agent] Triggered coding agent task", { runId: handle.id });

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
