import { getContentAgentBot } from "../bot";
import { registerOnNewMention } from "./handleContentAgentMention";
import { registerOnSubscribedMessage } from "./registerOnSubscribedMessage";

let registered = false;

/**
 * Registers all content agent event handlers on the bot singleton.
 * Safe to call multiple times — handlers are only attached once.
 */
export function ensureHandlersRegistered(): void {
  if (registered) return;
  registered = true;

  const bot = getContentAgentBot();
  registerOnNewMention(bot);
  registerOnSubscribedMessage(bot);
}
