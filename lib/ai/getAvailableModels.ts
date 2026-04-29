import { gateway } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";

/**
 * Returns the list of available LLMs from the Vercel AI Gateway.
 * Filters out embed models that are not suitable for chat.
 */
export const getAvailableModels = async () => {
  try {
    const { models } = await gateway.getAvailableModels();
    return models.filter(m => !isEmbedModel(m));
  } catch (error) {
    console.error("[getAvailableModels] gateway fetch failed:", error);
    return [];
  }
};
