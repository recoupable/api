import { gateway, GatewayLanguageModelEntry } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";

export const getAvailableModels = async (): Promise<GatewayLanguageModelEntry[]> => {
  try {
    const apiResponse = await gateway.getAvailableModels();
    const gatewayModels = apiResponse.models.filter(m => !isEmbedModel(m));
    return gatewayModels;
  } catch {
    return [];
  }
};
