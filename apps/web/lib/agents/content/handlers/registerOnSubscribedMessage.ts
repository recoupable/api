import type { ContentAgentBot } from "../bot";

/**
 * Registers the onSubscribedMessage handler for the content agent.
 * Handles replies in active threads while content is being generated.
 *
 * @param bot - The content agent bot instance to register the handler on
 */
export function registerOnSubscribedMessage(bot: ContentAgentBot) {
  bot.onSubscribedMessage(async (thread, message) => {
    // Guard against bot-authored messages to prevent echo loops
    if (message.author.isBot || message.author.isMe) return;

    const state = await thread.state;

    if (state?.status === "running") {
      await thread.post("Still generating your content. I'll reply here when it's ready.");
    }
  });
}
