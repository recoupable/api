import type { SlackChatBot } from "../bot";
import { handleSlackChatMessage } from "./handleSlackChatMessage";

/**
 * Registers the onNewMention handler on the Slack chat bot.
 * Subscribes to the thread for follow-up messages, then generates a response.
 *
 * @param bot - The Slack chat bot instance
 */
export function registerOnNewMention(bot: SlackChatBot) {
  bot.onNewMention(async (thread, message) => {
    try {
      await thread.subscribe();
      await handleSlackChatMessage(thread, message.text);
    } catch (error) {
      console.error("[slack-chat] onNewMention error:", error);
    }
  });
}
