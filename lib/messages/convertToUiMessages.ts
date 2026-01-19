import { UIMessage, ModelMessage } from "ai";
import generateUUID from "@/lib/uuid/generateUUID";
import isUiMessage from "@/lib/messages/isUiMessage";
import getTextContent from "@/lib/messages/getTextContent";

/**
 * Input message that can be either UIMessage or ModelMessage format.
 */
type InputMessage = UIMessage | ModelMessage;

/**
 * Converts messages to UIMessage format.
 *
 * Similar to AI SDK's convertToModelMessages, this utility normalizes
 * messages from various formats into the standard UIMessage format.
 *
 * Handles:
 * - UIMessage format (with parts array) - passed through unchanged
 * - ModelMessage format ({ role, content }) - converted to UIMessage
 * - Mixed arrays of both formats
 *
 * @param messages - Array of messages in any supported format
 * @returns Array of messages in UIMessage format
 */
export default function convertToUiMessages(messages: InputMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (isUiMessage(message)) {
      return message;
    }

    // Convert ModelMessage { role, content } format to UIMessage
    const modelMessage = message as ModelMessage;

    return {
      id: generateUUID(),
      role: modelMessage.role as "user" | "assistant" | "system",
      parts: [{ type: "text" as const, text: getTextContent(modelMessage.content) }],
    };
  });
}
