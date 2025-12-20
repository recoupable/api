import { UIMessage } from "ai";
import generateUUID from "@/lib/uuid/generateUUID";

/**
 * Converts a string message to an array of properly formatted message objects
 * Can be used to generate initial messages for chat components
 *
 * @param content - The text content of the message
 * @param role - Optional role for the message (defaults to "user")
 * @returns An array of properly formatted message objects
 */
export function getMessages(content?: string, role: string = "user"): UIMessage[] {
  if (!content) {
    return [];
  }

  return [
    {
      id: generateUUID(),
      role: role as "user" | "assistant" | "system",
      parts: [{ type: "text", text: content }],
    },
  ];
}
