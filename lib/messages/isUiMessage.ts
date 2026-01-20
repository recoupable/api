import { UIMessage } from "ai";

/**
 * Type guard to check if a message is in UIMessage format.
 *
 * UIMessage format has a `parts` array containing message content,
 * while simple format uses a `content` string directly.
 *
 * @param message - The message to check
 * @returns True if the message has a parts array (UIMessage format)
 */
export default function isUiMessage(message: unknown): message is UIMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "parts" in message &&
    Array.isArray((message as UIMessage).parts)
  );
}
