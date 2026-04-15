import { gateway, GatewayLanguageModelEntry } from "@ai-sdk/gateway";
import isEmbedModel from "./isEmbedModel";
import { DEFAULT_MODEL, LIGHTWEIGHT_MODEL } from "@/lib/const";

/**
 * Default model list for non-gateway providers (OpenRouter, direct OpenAI).
 * Returned when the Vercel AI Gateway is not configured.
 */
const DEFAULT_MODELS: GatewayLanguageModelEntry[] = [
  {
    id: DEFAULT_MODEL,
    name: "GPT-5 Mini",
    description: "Default model for chat and generation",
    specification: { specificationVersion: "v2", provider: "openai", modelId: DEFAULT_MODEL },
  },
  {
    id: LIGHTWEIGHT_MODEL,
    name: "GPT-4o Mini",
    description: "Lightweight model for simple tasks",
    specification: { specificationVersion: "v2", provider: "openai", modelId: LIGHTWEIGHT_MODEL },
  },
];

/**
 * Returns the list of available LLMs.
 * Uses Vercel AI Gateway when configured, otherwise returns a default list.
 */
export const getAvailableModels = async (): Promise<GatewayLanguageModelEntry[]> => {
  // Use Vercel AI Gateway when configured
  if (process.env.VERCEL_AI_GATEWAY_API_KEY) {
    try {
      const apiResponse = await gateway.getAvailableModels();
      const gatewayModels = apiResponse.models.filter(m => !isEmbedModel(m));
      return gatewayModels;
    } catch {
      return DEFAULT_MODELS;
    }
  }

  // Fallback for OpenRouter or direct OpenAI
  return DEFAULT_MODELS;
};
