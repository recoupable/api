import { slackChatBot } from "../bot";
import { registerOnNewMention } from "./onNewMention";
import { registerOnSubscribedMessage } from "./onSubscribedMessage";

/**
 * Registers all Slack chat bot event handlers on the bot singleton.
 * Import this file once to attach handlers to the bot.
 */
registerOnNewMention(slackChatBot);
registerOnSubscribedMessage(slackChatBot);
