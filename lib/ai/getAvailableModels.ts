import { gateway, GatewayLanguageModelEntry } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";

/**
 * Returns the list of available LLMs from the Vercel AI Gateway.
 * Filters out embed models that are not suitable for chat.
 */
export const getAvailableModels = async (): Promise<
  GatewayLanguageModelEntry[]
> => {
  try {
    const apiResponse = await gateway.getAvailableModels();
    const gatewayModels = apiResponse.models.filter((m) => !isEmbedModel(m));
    return gatewayModels;
  } catch {
    return [];
  }
};
