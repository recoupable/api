import { createEditOperationsAgent } from "./createEditOperationsAgent";
import type { EditOperationsResult } from "./createEditOperationsAgent";

export type { EditOperationsResult };

/**
 * Parses a natural-language edit request into structured ffmpeg operations
 * or a template reference.
 *
 * @param prompt - The user's edit instructions.
 * @returns Parsed edit operations, or null if parsing fails.
 */
export async function parseEditOperations(prompt: string): Promise<EditOperationsResult | null> {
  try {
    const agent = createEditOperationsAgent();
    const { output } = await agent.generate({ prompt });
    return output ?? null;
  } catch (error) {
    console.error("[content-agent] parseEditOperations failed:", error);
    return null;
  }
}
