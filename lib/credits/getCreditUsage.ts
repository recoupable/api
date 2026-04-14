import { getModel } from "@/lib/ai/getModel";
import { LanguageModelUsage } from "ai";

type CompatibleLanguageModelUsage = LanguageModelUsage & {
  promptTokens?: number;
  completionTokens?: number;
};

export const getCreditUsage = async (
  usage: LanguageModelUsage,
  modelId: string,
): Promise<number> => {
  try {
    const model = await getModel(modelId);
    if (!model) {
      console.error(`Model not found for ID: ${modelId}`);
      return 0;
    }

    // LanguageModelUsage uses inputTokens/outputTokens (SDK v3)
    // or promptTokens/completionTokens (SDK v2 compatibility)
    const usageWithCompatibility = usage as CompatibleLanguageModelUsage;
    const inputTokens = usage.inputTokens ?? usageWithCompatibility.promptTokens;
    const outputTokens = usage.outputTokens ?? usageWithCompatibility.completionTokens;

    if (!inputTokens || !outputTokens) {
      console.error("No tokens found in usage");
      return 0;
    }

    // Check if model has pricing
    if (!model.pricing?.input || !model.pricing?.output) {
      return 0;
    }

    const inputCost = inputTokens * Number(model.pricing.input);
    const outputCost = outputTokens * Number(model.pricing.output);
    const totalCost = inputCost + outputCost;

    return totalCost;
  } catch (error) {
    console.error("Failed to calculate credit usage:", error);
    return 0;
  }
};
