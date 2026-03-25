import type { ContentAgentBot } from "../bot";

/**
 * Registers the onSubscribedMessage handler for the content agent.
 * Handles replies in active threads while content is being generated.
 *
 * @param bot
 */
export function registerOnSubscribedMessage(bot: ContentAgentBot) {
  bot.onSubscribedMessage(async (thread, _message) => {
    const state = await thread.state;

    if (state?.status === "running") {
      await thread.post("Still generating your content. I'll reply here when it's ready.");
    }
  });
}
