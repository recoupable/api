import { generateText } from "ai";
import type { TextPart } from "ai";

/**
 * Extracts the final text content from the last step of a multi-step GenerateTextResult.
 * Joins all TextPart content from the last step's content array into a single string.
 *
 * @param result - The GenerateTextResult returned by the AI SDK generateText call
 * @returns The concatenated text from the last step, or null if no steps or text parts exist
 */
export function extractTextResultFromSteps(
  result: Awaited<ReturnType<typeof generateText>>,
): string | null {
  if (!result.steps || !Array.isArray(result.steps) || result.steps.length === 0) {
    return null;
  }

  const lastStep = result.steps[result.steps.length - 1];

  if (!lastStep.content || !Array.isArray(lastStep.content)) {
    return null;
  }

  const textParts = lastStep.content
    .filter(
      (part: unknown): part is TextPart =>
        typeof part === "object" && part !== null && "type" in part && part.type === "text",
    )
    .map((part: TextPart) => part.text)
    .join("");

  return textParts || null;
}
