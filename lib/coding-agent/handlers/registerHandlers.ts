import { codingAgentBot } from "../bot";
import { registerOnNewMention } from "./onNewMention";

/**
 * Registers all coding agent event handlers on the bot singleton.
 * Import this file once to attach handlers to the bot.
 */
registerOnNewMention(codingAgentBot);
