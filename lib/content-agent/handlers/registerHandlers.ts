import { contentAgentBot } from "../bot";
import { registerOnNewMention } from "./handleContentAgentMention";
import { registerOnSubscribedMessage } from "./handleContentAgentCallback";

/**
 * Registers all content agent event handlers on the bot singleton.
 * Import this file once to attach handlers to the bot.
 */
registerOnNewMention(contentAgentBot);
registerOnSubscribedMessage(contentAgentBot);
