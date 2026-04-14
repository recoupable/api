import type { CodingAgentBot } from "../bot";
import { handleFeedback } from "./handleFeedback";

/**
 * Register On Subscribed Message.
 *
 * @param bot - Value for bot.
 * @returns - Computed result.
 */
export function registerOnSubscribedMessage(bot: CodingAgentBot) {
  bot.onSubscribedMessage(async (thread, message) => {
    const state = await thread.state;
    if (!state) return;
    await handleFeedback(thread, message.text, state);
  });
}
