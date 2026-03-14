import type { CodingAgentBot } from "../bot";
import { handleFeedback } from "./handleFeedback";

/**
 * Registers the onSubscribedMessage handler on the bot.
 * Delegates to handleFeedback for busy/update-pr logic.
 *
 * @param bot
 */
export function registerOnSubscribedMessage(bot: CodingAgentBot) {
  bot.onSubscribedMessage(async (thread, message) => {
    const state = await thread.state;
    if (!state) return;
    await handleFeedback(thread, message.text, state);
  });
}
