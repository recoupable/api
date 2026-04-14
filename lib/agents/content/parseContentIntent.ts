import { createContentIntentAgent } from "./createContentIntentAgent";
import type { ContentIntent } from "./createContentIntentAgent";

export type { ContentIntent };

/**
 * Uses AI to classify whether a thread reply is requesting an edit to
 * existing content or a new generation.
 *
 * @param prompt - The user's reply message text.
 * @param threadContext - Summary of what was previously generated (template, video count, etc.).
 * @returns The classified intent, defaulting to "edit" on failure.
 */
export async function parseContentIntent(
  prompt: string,
  threadContext: string,
): Promise<ContentIntent> {
  try {
    const agent = createContentIntentAgent();
    const { output } = await agent.generate({
      prompt: `Thread context: ${threadContext}\n\nUser's new message: ${prompt}`,
    });

    return output ?? { action: "edit" };
  } catch (error) {
    console.error("[content-agent] parseContentIntent failed:", error);
    return { action: "edit" };
  }
}
