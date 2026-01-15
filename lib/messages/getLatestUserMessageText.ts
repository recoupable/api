import { UIMessage } from "ai";

/**
 * Extracts the text content from the most recent user message
 *
 * @param messages - Array of UI messages
 * @returns The text content of the latest user message, or empty string if none found
 */
export default function getLatestUserMessageText(messages: UIMessage[]): string {
  const userMessages = messages.filter((msg) => msg.role === "user");
  const latestUserMessage = userMessages[userMessages.length - 1];
  return latestUserMessage?.parts?.find((part) => part.type === "text")?.text || "";
}
