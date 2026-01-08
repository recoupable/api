interface UIPart {
  type: string;
  text?: string;
}

/**
 * Extracts text content from UI parts.
 *
 * @param parts - UI parts from stored memory
 * @returns Combined text string from all text parts
 */
export function extractTextFromParts(parts: UIPart[]): string {
  return parts
    .filter(p => p.type === "text" && p.text)
    .map(p => p.text!)
    .join("\n");
}
