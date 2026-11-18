import { getModel } from "@/lib/ai/getModel";
import type { LanguageModelUsage } from "ai";

/** Resolve the existing token estimate inside a durable step; never performs a debit. */
export async function getTokenCreditUsageStep(
  usage: Pick<LanguageModelUsage, "inputTokens" | "outputTokens">,
  modelId: string,
): Promise<number> {
  "use step";
  try {
    const model = await getModel(modelId);
    if (!model) {
      console.error(`Model not found for ID: ${modelId}`);
      return 0;
    }

    const { inputTokens, outputTokens } = usage;

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
}
