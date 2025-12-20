import { UIMessage } from "ai";

/**
 * Validates the messages and returns the last message and the valid messages.
 *
 * @param messages - The messages to validate
 * @returns The last message and the valid messages
 */
export function validateMessages(messages: UIMessage[]) {
  if (!messages.length) {
    throw new Error("No messages provided");
  }

  return {
    lastMessage: messages[messages.length - 1],
    validMessages: messages.filter(m => m.parts.find(part => part.type === "text")?.text?.length),
  };
}
