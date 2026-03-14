import { ModelMessage } from "ai";

/**
 * Extracts text from ModelMessage content (handles string or content parts array).
 *
 * @param content - The content field from ModelMessage
 * @returns The extracted text string
 */
export default function getTextContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  // Content is an array of parts - extract and join text parts
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map(part => part.text)
    .join("");
}
