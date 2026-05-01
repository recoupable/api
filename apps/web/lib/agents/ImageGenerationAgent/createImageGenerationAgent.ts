import { ToolLoopAgent } from "ai";

/**
 * Creates a ToolLoopAgent configured for image generation.
 *
 * @returns A configured ToolLoopAgent instance for image generation.
 */
export function createImageGenerationAgent() {
  return new ToolLoopAgent({
    model: "google/gemini-3-pro-image",
    instructions: "You are an image generation assistant. Generate / Edit images based on prompts.",
  });
}
