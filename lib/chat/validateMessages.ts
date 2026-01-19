import type { UIMessage } from "ai";

/**
 * Validates messages and returns the last message.
 *
 * @param messages - Array of UI messages to validate
 * @returns Object containing lastMessage and validMessages
 * @throws Error if no messages provided
 */
export function validateMessages(messages: UIMessage[]) {
  if (!messages.length) {
    throw new Error("No messages provided");
  }

  return {
    lastMessage: messages[messages.length - 1],
    validMessages: messages.filter(
      (m) => m.parts.find((part) => part.type === "text")?.text?.length,
    ),
  };
}
