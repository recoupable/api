import { codingAgentBot } from "../bot";
import { registerOnNewMention } from "./onNewMention";
import { registerOnSubscribedMessage } from "./onSubscribedMessage";
import { registerOnMergeAction } from "./onMergeAction";
import { registerOnMergeTestToMainAction } from "./onMergeTestToMainAction";

/**
 * Registers all coding agent event handlers on the bot singleton.
 * Import this file once to attach handlers to the bot.
 */
registerOnNewMention(codingAgentBot);
registerOnSubscribedMessage(codingAgentBot);
registerOnMergeAction(codingAgentBot);
registerOnMergeTestToMainAction(codingAgentBot);
