import { gateway } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";

export const getAvailableModels = async () => {
  try {
    const { models } = await gateway.getAvailableModels();
    return models.filter(m => !isEmbedModel(m));
  } catch (error) {
    console.error("[getAvailableModels] gateway fetch failed:", error);
    return [];
  }
};
