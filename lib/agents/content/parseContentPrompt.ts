import { createContentPromptAgent, DEFAULT_CONTENT_PROMPT_FLAGS } from "./createContentPromptAgent";
import type { ContentPromptFlags } from "./createContentPromptAgent";

export type { ContentPromptFlags };

/**
 * Parses a natural-language content creation prompt into structured flags
 * for the POST /api/content/create endpoint.
 *
 * Falls back to safe defaults if the AI call fails.
 *
 * @param prompt - The natural-language content creation request.
 * @returns Structured flags for the content creation endpoint.
 */
export async function parseContentPrompt(prompt: string): Promise<ContentPromptFlags> {
  try {
    const agent = createContentPromptAgent();
    const { output } = await agent.generate({ prompt });

    return output ?? { ...DEFAULT_CONTENT_PROMPT_FLAGS };
  } catch (error) {
    console.error("[content-agent] parseContentPrompt failed:", error);
    return { ...DEFAULT_CONTENT_PROMPT_FLAGS };
  }
}
