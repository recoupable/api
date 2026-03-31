import { generateText } from "ai";
import { extractTextResultFromSteps } from "./extractTextResultFromSteps";

/**
 * Extracts plain text from a GenerateTextResult, handling both single-step and
 * multi-step responses. Falls back to the top-level text or content fields when
 * no steps are present.
 *
 * @param result - The GenerateTextResult returned by the AI SDK generateText call
 * @returns The extracted text string, or a fallback message if no content was found
 */
export function extractTextFromResult(result: Awaited<ReturnType<typeof generateText>>): string {
  // Handle multi-step responses (when maxSteps > 1)
  const stepsText = extractTextResultFromSteps(result);
  if (stepsText) return stepsText;

  // Fallback to direct text/content properties
  if (typeof result.text === "string") {
    return result.text;
  }

  if (typeof result.content === "string") {
    return result.content;
  }

  return String(result.text || result.content || "No response content");
}
