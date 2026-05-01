import type { SlackChatBot } from "../bot";
import { handleSlackChatMessage } from "./handleSlackChatMessage";

/**
 * Registers the onSubscribedMessage handler on the Slack chat bot.
 * Reuses the existing roomId from thread state for conversational memory.
 *
 * @param bot - The Slack chat bot instance
 */
export function registerOnSubscribedMessage(bot: SlackChatBot) {
  bot.onSubscribedMessage(async (thread, message) => {
    try {
      await handleSlackChatMessage(thread, message.text);
    } catch (error) {
      console.error("[slack-chat] onSubscribedMessage error:", error);
    }
  });
}
