import { generateText } from "ai";
import type { TextPart } from "ai";

/**
 * Extract Text Result From Steps.
 *
 * @param result - Value for result.
 * @returns - Computed result.
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
