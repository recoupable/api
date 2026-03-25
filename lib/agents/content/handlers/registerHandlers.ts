import { contentAgentBot } from "../bot";
import { registerOnNewMention } from "./registerOnNewMention";
import { registerOnSubscribedMessage } from "./registerOnSubscribedMessage";

/**
 * Registers all content agent event handlers on the bot singleton.
 * Import this file once to attach handlers to the bot.
 */
if (contentAgentBot) {
  registerOnNewMention(contentAgentBot);
  registerOnSubscribedMessage(contentAgentBot);
}
