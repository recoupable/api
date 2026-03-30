import { DEFAULT_CONTENT_TEMPLATE } from "@/lib/content/contentTemplates";
import { createContentPromptAgent } from "./createContentPromptAgent";
import type { ContentPromptFlags } from "./createContentPromptAgent";

export type { ContentPromptFlags };

const DEFAULT_FLAGS: ContentPromptFlags = {
  lipsync: false,
  batch: 1,
  captionLength: "short",
  upscale: false,
  template: DEFAULT_CONTENT_TEMPLATE,
};

/**
 * Parses a natural-language content creation prompt into structured flags
 * for the POST /api/content/create endpoint.
 *
 * Falls back to safe defaults if the AI call fails.
 *
 * @param prompt - The user's natural-language content creation request.
 * @returns Structured flags for the content creation endpoint.
 */
export async function parseContentPrompt(prompt: string): Promise<ContentPromptFlags> {
  try {
    const agent = createContentPromptAgent();
    const { output } = await agent.generate({ prompt });

    return output ?? DEFAULT_FLAGS;
  } catch (error) {
    console.error("[content-agent] parseContentPrompt failed:", error);
    return DEFAULT_FLAGS;
  }
}
