import { ToolLoopAgent } from "ai";
import { createModel } from "@/lib/ai/createModel";

/**
 * Creates a ToolLoopAgent configured for image generation.
 *
 * @returns A configured ToolLoopAgent instance for image generation.
 */
export function createImageGenerationAgent() {
  return new ToolLoopAgent({
    model: createModel("google/gemini-3-pro-image"),
    instructions: "You are an image generation assistant. Generate / Edit images based on prompts.",
  });
}
