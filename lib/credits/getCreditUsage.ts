import { getModel } from "@/lib/ai/getModel";
import { LanguageModelUsage } from "ai";

/**
 * Calculates the total spend in USD for a given language model usage.
 *
 * @param usage - The language model usage data
 * @param modelId - The ID of the model used
 * @returns The total spend in USD or 0 if calculation fails
 */
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
    const inputTokens = (usage as any).inputTokens ?? (usage as any).promptTokens;
    const outputTokens = (usage as any).outputTokens ?? (usage as any).completionTokens;

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
